from flask import Flask, render_template, request, jsonify, session, g
import uuid
import re
import logging
import os
from datetime import timedelta
from openai import RateLimitError, APIConnectionError, APIError

logger = logging.getLogger(__name__)

from config import (
    FLASK_SECRET_KEY,
    FLASK_HOST,
    FLASK_PORT,
    FLASK_DEBUG,
    SYSTEM_PROMPT,
    SESSION_PERMANENT,
    SESSION_LIFETIME_HOURS,
    SESSION_COOKIE_SECURE,
    SESSION_COOKIE_HTTPONLY,
    SESSION_COOKIE_SAMESITE,
)
from utils.storage import (
    save_conversation,
    load_conversation,
    list_conversations as get_all_conversations,  # Rename imported function
    delete_conversation as storage_delete_conversation,
    save_escalation,
)
from utils.session_manager import session_manager
from utils.chatbot import ChatBot
from utils.escalation_utils import extract_handover_info, is_handover_confirmation
from utils.email_notifications import (
    init_mail,
    send_escalation_confirmation_email,
    extract_email_from_conversation, mail
)
from utils.validation import (
    validate_email,
    validate_conversation_id,
    validate_message,
    sanitize_input
)
from config import (
    MAIL_SERVER,
    MAIL_PORT,
    MAIL_USE_TLS,
    MAIL_USE_SSL,
    MAIL_USERNAME,
    MAIL_PASSWORD,
    MAIL_FROM_EMAIL,
    MAIL_FROM_NAME,
)

app = Flask(__name__)

# Configure Flask session
app.secret_key = FLASK_SECRET_KEY
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=SESSION_LIFETIME_HOURS)
app.config["SESSION_COOKIE_SECURE"] = SESSION_COOKIE_SECURE
app.config["SESSION_COOKIE_HTTPONLY"] = SESSION_COOKIE_HTTPONLY
app.config["SESSION_COOKIE_SAMESITE"] = SESSION_COOKIE_SAMESITE

# Configure Flask-Mail
app.config["MAIL_SERVER"] = MAIL_SERVER
app.config["MAIL_PORT"] = MAIL_PORT
app.config["MAIL_USE_TLS"] = MAIL_USE_TLS
app.config["MAIL_USE_SSL"] = MAIL_USE_SSL
app.config["MAIL_USERNAME"] = MAIL_USERNAME
app.config["MAIL_PASSWORD"] = MAIL_PASSWORD
# Set default sender (required by Flask-Mail)
app.config["MAIL_DEFAULT_SENDER"] = (MAIL_FROM_NAME or "Strength Club", MAIL_FROM_EMAIL)

# Initialize Flask-Mail
init_mail(app)

# Initialize chatbot instance
chatbot = ChatBot()
chat_sessions = {}


@app.before_request
def before_request():
    """Initialize session before each request and validate JSON requests"""
    # Validate JSON for POST requests
    if request.method == 'POST' and request.is_json:
        try:
            request.get_json(force=True)
        except Exception as e:
            logger.warning(f"Invalid JSON in request: {e}")
            return jsonify({"success": False, "error": "Invalid JSON format"}), 400
    
    # Initialize session if needed
    session_manager.init_session()

    # Check if session is valid
    if not session_manager.is_session_valid():
        # Session expired - clear it and start fresh
        session_manager.clear_session()
        session_manager.init_session()
        # Explicitly clear conversation_id to ensure fresh start
        session_manager.clear_conversation()

    # Make session permanent if configured
    if SESSION_PERMANENT:
        session.permanent = True

    # Store session manager in g for easy access
    g.session_manager = session_manager

@app.route("/")
def index():
    return render_template("chat.html")


@app.route("/api/start_session", methods=["POST"])
def start_session():
    """Initialize a new chat session"""
    try:
        data = request.json or {}
        load_existing = data.get("load_existing", False)
        conversation_id = data.get("conversation_id")

        if load_existing and conversation_id:
            # Validate conversation_id format
            if not validate_conversation_id(conversation_id):
                return jsonify({"success": False, "error": "Invalid conversation ID format"}), 400
            
            # Load existing conversation
            try:
                conv_data = load_conversation(conversation_id)
            except Exception as e:
                logger.error(f"Error loading conversation {conversation_id}: {e}", exc_info=True)
                return jsonify({"success": False, "error": "Failed to load conversation"}), 500
            
            if conv_data:
                session_manager.set_conversation(conversation_id)
                # Load into memory cache
                if conversation_id not in chat_sessions:
                    chat_sessions[conversation_id] = {
                        "messages": conv_data.get("messages", []),
                        "escalated": conv_data.get("escalated", False),
                    }
                return jsonify(
                    {
                        "success": True,
                        "conversation_id": conversation_id,
                        "loaded": True,
                        "title": conv_data.get("title", "New Chat"),
                        "messages": [
                            m for m in conv_data.get("messages", []) if m.get("role") != "system"
                        ],
                        "escalated": conv_data.get("escalated", False),
                    }
                )
            else:
                return jsonify({"success": False, "error": "Conversation not found"}), 404

        # Create new conversation
        conversation_id = str(uuid.uuid4())
        session_manager.set_conversation(conversation_id)

        # Initialize conversation with system prompt
        chat_sessions[conversation_id] = {
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}],
            "escalated": False,
        }

        # Save initial conversation
        try:
            save_conversation(
                conversation_id, chat_sessions[conversation_id]["messages"], False
            )
        except Exception as e:
            logger.error(f"Error saving initial conversation: {e}", exc_info=True)
            # Continue anyway - conversation is in memory
            return jsonify({
                "success": False,
                "error": "Failed to save conversation. Please try again."
            }), 500

        return jsonify(
            {
                "success": True,
                "conversation_id": conversation_id,
                "loaded": False,
                "welcome_message": "Welcome to Strength Club! I'm here if you have any questions about training, nutrition, or coaching. What can I help you with today?",
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in start_session: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An error occurred. Please try again."}), 500


@app.route("/api/chat", methods=["POST"])
def send_message():
    """Handle incoming chat messages"""
    try:
        data = request.json or {}
        user_message = data.get("message", "").strip()

        # Validate message
        is_valid, error_msg = validate_message(user_message, max_length=10000)
        if not is_valid:
            return jsonify({"success": False, "error": error_msg}), 400

        # Accept session_id from request, or use session manager as fallback
        session_id = data.get("session_id")
        if session_id:
            # Validate session_id format
            if not validate_conversation_id(session_id):
                return jsonify({"success": False, "error": "Invalid session ID format"}), 400
            conversation_id = session_id
            session_manager.set_conversation(conversation_id)
        else:
            conversation_id = session_manager.get_conversation_id()

        if not conversation_id:
            return jsonify({"success": False, "error": "No active conversation. Please start a new chat."}), 400

        # Extend session on activity
        session_manager.extend_session()

        # Get or load session from file if not in memory
        if conversation_id not in chat_sessions:
            try:
                conv_data = load_conversation(conversation_id)
                if conv_data:
                    chat_sessions[conversation_id] = {
                        "messages": conv_data.get("messages", []),
                        "escalated": conv_data.get("escalated", False),
                    }
                else:
                    chat_sessions[conversation_id] = {
                        "messages": [{"role": "system", "content": SYSTEM_PROMPT}],
                        "escalated": False,
                    }
            except Exception as e:
                logger.error(f"Error loading conversation {conversation_id}: {e}", exc_info=True)
                # Create new session if loading fails
                chat_sessions[conversation_id] = {
                    "messages": [{"role": "system", "content": SYSTEM_PROMPT}],
                    "escalated": False,
                }

        # Check if already escalated
        if chat_sessions[conversation_id]["escalated"]:
            return jsonify(
                {
                    "response": "Your request has been escalated to our team. A representative will contact you shortly.",
                    "escalation_needed": True,
                    "session_id": conversation_id,
                }
            )

        # Add user message
        chat_sessions[conversation_id]["messages"].append(
            {"role": "user", "content": user_message}
        )

        try:
            # Check for escalation BEFORE calling AI - if detected, provide simple acknowledgment
            escalation_detected = chatbot.detect_escalation(user_message)
            
            if escalation_detected:
                # User requested human assistance - provide simple acknowledgment
                # The modal will handle collecting contact info
                bot_reply = "I'd be happy to connect you with our team. Please fill in the form so we can get in touch with you."
                chat_sessions[conversation_id]["escalated"] = True
                # Don't create escalation record here - wait for user to submit escalation form
                # The frontend will show the escalation modal to collect contact info
            else:
                # Normal flow - get AI response
                bot_reply, escalation_detected = chatbot.get_response(
                    chat_sessions[conversation_id]["messages"], user_message=user_message
                )
                
                # If AI detected escalation in its response, mark as escalated
                if escalation_detected:
                    chat_sessions[conversation_id]["escalated"] = True

            # Add assistant message
            chat_sessions[conversation_id]["messages"].append(
                {"role": "assistant", "content": bot_reply}
            )
            
            # Check if this is a handover confirmation message (low-priority escalation)
            # Only check if escalation was not already detected (to avoid double-processing)
            if not escalation_detected and is_handover_confirmation(bot_reply):
                # Extract user information from handover confirmation
                handover_info = extract_handover_info(bot_reply)
                if handover_info:
                    # Create low-priority escalation with extracted info
                    contact_info = {
                        'name': handover_info.get('name', ''),
                        'mobile': handover_info.get('mobile', ''),
                        'goal': handover_info.get('goal', ''),
                        'plan': handover_info.get('plan', '')
                    }
                    
                    # First try to get email from handover confirmation
                    email = handover_info.get('email', '')
                    # Fallback to conversation search if not in confirmation
                    if not email:
                        email = extract_email_from_conversation(chat_sessions[conversation_id]["messages"])
                    if email:
                        contact_info['email'] = email
                    
                    try:
                        escalation_data = save_escalation(
                            conversation_id,
                            "Handover confirmation - customer details collected",
                            contact_info,
                            priority='low'
                        )
                    except Exception as save_error:
                        logger.error(f"Error saving low-priority escalation: {save_error}", exc_info=True)
                        escalation_data = None
                    
                    # Send email notification if email is available
                    if escalation_data and email:
                        try:
                            email_sent = send_escalation_confirmation_email(
                                email,
                                handover_info.get('name', 'Customer'),
                                priority='low'
                            )
                            if not email_sent:
                                logger.warning(f"Email sending returned False for {email} (low priority). Check email configuration and logs.")
                        except Exception as e:
                            logger.error(f"Failed to send escalation email to {email}: {e}", exc_info=True)
                            # Don't fail the escalation if email fails
                    
                    # Mark as escalated (but low priority)
                    chat_sessions[conversation_id]["escalated"] = True

            # Save conversation
            try:
                save_conversation(
                    conversation_id,
                    chat_sessions[conversation_id]["messages"],
                    chat_sessions[conversation_id]["escalated"],
                )
            except Exception as save_error:
                logger.error(f"Error saving conversation {conversation_id}: {save_error}", exc_info=True)
                # Continue - conversation is still in memory

            return jsonify(
                {
                    "response": bot_reply,
                    "escalation_needed": escalation_detected,
                    "session_id": conversation_id,
                }
            )

        except RateLimitError as e:
            logger.error(f"OpenAI rate limit exceeded: {e}")
            return jsonify({
                "success": False,
                "error": "Service is temporarily busy. Please try again in a moment.",
                "retry_after": 60
            }), 429
        except APIConnectionError as e:
            logger.error(f"OpenAI connection error: {e}")
            return jsonify({
                "success": False,
                "error": "Unable to connect to AI service. Please check your connection and try again."
            }), 503
        except APIError as e:
            logger.error(f"OpenAI API error: {e}")
            return jsonify({
                "success": False,
                "error": "AI service error. Please try again."
            }), 500
        except ValueError as e:
            logger.error(f"Invalid request: {e}")
            return jsonify({
                "success": False,
                "error": str(e)
            }), 400
        except Exception as e:
            logger.error(f"Unexpected error in send_message: {e}", exc_info=True)
            return jsonify({
                "success": False,
                "error": "Failed to get response. Please try again."
            }), 500
    except Exception as e:
        logger.error(f"Unexpected error in send_message (outer): {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "An error occurred. Please try again."
        }), 500


@app.route("/api/escalate", methods=["POST"])
def escalate_to_human():
    """Escalate conversation to human support (high priority)"""
    try:
        data = request.json
        if not data:
            return jsonify({"success": False, "error": "Invalid request data"}), 400
        
        # Try to get conversation_id from request first, then fall back to session
        conversation_id = data.get("conversation_id") or session_manager.get_conversation_id()
        reason = data.get("reason", "Customer requested immediate human assistance")
        contact_info = data.get("contact_info", {})
        
        # Validate required fields
        if not contact_info:
            return jsonify({"success": False, "error": "Contact information is required"}), 400
        
        name = contact_info.get('name', '').strip() if contact_info.get('name') else ''
        mobile = contact_info.get('mobile', '').strip() if contact_info.get('mobile') else ''
        email = contact_info.get('email', '').strip() if contact_info.get('email') else ''
        
        # Normalize field names: accept both 'phone' and 'mobile'
        if 'phone' in contact_info and not mobile:
            mobile = contact_info.get('phone', '').strip()
            contact_info['mobile'] = mobile
        
        # Validate required fields
        if not name:
            return jsonify({"success": False, "error": "Name is required"}), 400
        
        if not mobile:
            return jsonify({"success": False, "error": "Mobile number is required"}), 400
        
        if not email:
            return jsonify({"success": False, "error": "Email address is required"}), 400
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            return jsonify({"success": False, "error": "Invalid email format"}), 400
        
        # Validate conversation_id
        if not conversation_id:
            logger.warning("No conversation_id found in request or session")
            return jsonify({"success": False, "error": "No active conversation. Please start a new chat."}), 400
        
        if not isinstance(conversation_id, str) or len(conversation_id) != 36:
            return jsonify({"success": False, "error": "Invalid conversation ID format"}), 400
        
        # Update session with conversation_id if it came from request
        if data.get("conversation_id") and not session_manager.get_conversation_id():
            session_manager.set_conversation(conversation_id)

        # Get conversation messages to extract goal/plan if not provided
        try:
            if conversation_id in chat_sessions:
                messages = chat_sessions[conversation_id]["messages"]
            else:
                conv_data = load_conversation(conversation_id)
                messages = conv_data.get("messages", []) if conv_data else []
        except Exception as e:
            logger.error(f"Error loading conversation for escalation: {e}", exc_info=True)
            messages = []
        
        # Extract goal and plan from conversation if not already in contact_info
        if 'goal' not in contact_info or 'plan' not in contact_info:
            # Look for handover confirmation in assistant messages
            for msg in reversed(messages):
                if msg.get("role") == "assistant":
                    bot_reply = msg.get("content", "")
                    if is_handover_confirmation(bot_reply):
                        handover_info = extract_handover_info(bot_reply)
                        if handover_info:
                            if 'goal' not in contact_info:
                                contact_info['goal'] = handover_info.get('goal', '')
                            if 'plan' not in contact_info:
                                contact_info['plan'] = handover_info.get('plan', '')
                            break
        
        # Extract issue/context if provided in contact_info
        issue = contact_info.get('issue', '')
        conversation_context = contact_info.get('conversation_context', [])
        
        # Build context summary from conversation if issue is empty but context is available
        if not issue and conversation_context:
            # Extract last few user messages as context
            user_messages = [msg.get('content', '') for msg in conversation_context if msg.get('role') == 'user']
            if user_messages:
                issue = ' '.join(user_messages[-3:])  # Last 3 user messages as context
        
        # Store issue/context in contact_info for reference
        if issue:
            contact_info['issue'] = issue

        # Save high-priority escalation (works regardless of whether session is in memory)
        try:
            escalation_data = save_escalation(conversation_id, reason, contact_info, priority='high')
        except Exception as save_error:
            logger.error(f"Exception while saving escalation for conversation {conversation_id}: {save_error}", exc_info=True)
            return jsonify({
                "success": False,
                "error": f"Failed to save escalation: {str(save_error)}"
            }), 500
        
        if not escalation_data:
            logger.error(f"Failed to save escalation for conversation {conversation_id} - save_escalation returned None")
            return jsonify({
                "success": False,
                "error": "Failed to save escalation. Please check server logs and try again."
            }), 500
        
        # Mark session as escalated if it's in memory
        if conversation_id in chat_sessions:
            chat_sessions[conversation_id]["escalated"] = True
            # Save updated conversation
            save_conversation(
                conversation_id, chat_sessions[conversation_id]["messages"], escalated=True
            )
        else:
            # Load conversation from storage and update escalated status
            conv_data = load_conversation(conversation_id)
            if conv_data:
                conv_data["escalated"] = True
                save_conversation(
                    conversation_id, conv_data.get("messages", []), escalated=True
                )
        
        # Send email notification if email is provided
        email = contact_info.get('email', '')
        if email:
            try:
                email_sent = send_escalation_confirmation_email(
                    email,
                    contact_info.get('name', 'Customer'),
                    priority='high'
                )
                if not email_sent:
                    logger.warning(f"Email sending returned False for {email}. Check email configuration and logs.")
            except Exception as e:
                logger.error(f"Failed to send escalation email to {email}: {e}", exc_info=True)
                # Don't fail the escalation if email fails

        return jsonify(
            {
                "success": True,
                "message": "Your conversation has been escalated to our support team. A representative will contact you shortly.",
            }
        )
    except Exception as e:
        logger.error(f"Error processing escalation: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "An error occurred while processing your request. Please try again."
        }), 500


@app.route("/api/get_history", methods=["GET"])
def get_history():
    """Get conversation history for current session"""
    try:
        conversation_id = session_manager.get_conversation_id()

        if not conversation_id:
            return jsonify({"success": False, "error": "No active conversation"}), 400

        # Try to get from memory cache first
        if conversation_id in chat_sessions:
            messages = [
                msg
                for msg in chat_sessions[conversation_id].get("messages", [])
                if msg.get("role") != "system"
            ]
            return jsonify(
                {
                    "success": True,
                    "messages": messages,
                    "escalated": chat_sessions[conversation_id].get("escalated", False),
                }
            )

        # If not in memory, try to load from JSON file
        try:
            conv_data = load_conversation(conversation_id)
            if conv_data:
                # Load into memory cache for future use
                chat_sessions[conversation_id] = {
                    "messages": conv_data.get("messages", []),
                    "escalated": conv_data.get("escalated", False),
                }
                messages = [msg for msg in conv_data.get("messages", []) if msg.get("role") != "system"]
                return jsonify(
                    {
                        "success": True,
                        "messages": messages,
                        "escalated": conv_data.get("escalated", False),
                    }
                )
        except Exception as e:
            logger.error(f"Error loading conversation {conversation_id}: {e}", exc_info=True)
            return jsonify({"success": False, "error": "Failed to load conversation"}), 500

        # No conversation found
        return jsonify({"success": True, "messages": [], "escalated": False})
    except Exception as e:
        logger.error(f"Unexpected error in get_history: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An error occurred. Please try again."}), 500


@app.route("/api/past-chats", methods=["GET"])
def get_past_chats():
    """List previous conversations for logged-in users"""
    try:
        # Get all conversations
        # TODO: When login is implemented, filter by user_id:
        #   1. Add user_id to session when user logs in
        #   2. Add user_id field to conversation data when saving
        #   3. Create get_user_conversations(user_id) function in utils/storage.py
        #   4. Filter conversations: user_id = session.get('user_id'); if user_id: conversations = get_user_conversations(user_id)
        conversations = get_all_conversations()
        
        return jsonify({"success": True, "conversations": conversations})
    except Exception as e:
        logger.error(f"Error getting past chats: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Failed to load conversations"}), 500

@app.route("/api/new-chat", methods=["POST"])
def new_chat():
    """Start fresh conversation (clear session and create new chat)"""
    try:
        # Clear current conversation from session
        session_manager.clear_conversation()

        # Create new conversation_id
        conversation_id = str(uuid.uuid4())
        session_manager.set_conversation(conversation_id)

        # Initialize conversation with system prompt
        chat_sessions[conversation_id] = {
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}],
            "escalated": False,
        }

        # Save initial conversation
        try:
            save_conversation(
                conversation_id, chat_sessions[conversation_id]["messages"], False
            )
        except Exception as e:
            logger.error(f"Error saving new conversation: {e}", exc_info=True)
            # Continue anyway - conversation is in memory
            return jsonify({
                "success": False,
                "error": "Failed to save conversation. Please try again."
            }), 500

        return jsonify(
            {
                "success": True,
                "conversation_id": conversation_id,
                "message": "New chat started",
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in new_chat: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An error occurred. Please try again."}), 500


@app.route("/api/delete_conversation", methods=["POST"])
def delete_conversation():
    """Delete a conversation"""
    try:
        data = request.json or {}
        conversation_id = data.get("conversation_id")

        if not conversation_id:
            return jsonify({"success": False, "error": "No conversation ID provided"}), 400
        
        # Validate conversation_id format
        if not isinstance(conversation_id, str) or len(conversation_id) != 36:
            return jsonify({"success": False, "error": "Invalid conversation ID format"}), 400

        # Delete from storage
        try:
            deleted = storage_delete_conversation(conversation_id)
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}", exc_info=True)
            return jsonify({"success": False, "error": "Failed to delete conversation"}), 500
        
        if deleted:
            # Remove from memory if loaded
            if conversation_id in chat_sessions:
                del chat_sessions[conversation_id]

            # If this was the active conversation, clear it from session
            if session_manager.get_conversation_id() == conversation_id:
                session_manager.clear_conversation()

            return jsonify({"success": True, "message": "Conversation deleted"})
        else:
            return jsonify({"success": False, "error": "Conversation not found"}), 404
    except Exception as e:
        logger.error(f"Unexpected error in delete_conversation: {e}", exc_info=True)
        return jsonify({"success": False, "error": "An error occurred. Please try again."}), 500


@app.route("/api/session_info", methods=["GET"])
def get_session_info():
    """Get current session information"""
    return jsonify({"success": True, "session": session_manager.get_session_info()})


@app.route("/api/end_session", methods=["POST"])
def end_session():
    """End current session"""
    session_manager.clear_session()
    return jsonify({"success": True, "message": "Session ended"})


@app.route("/health")
def health():
    """Health check endpoint with dependency checks"""
    checks = {
        "status": "healthy",
        "openai": "ok",
        "storage": "ok",
        "email": "ok" if mail else "not_configured"
    }
    
    # Check OpenAI configuration
    try:
        from config import OPENAI_API_KEY
        if not OPENAI_API_KEY:
            checks["openai"] = "not_configured"
    except Exception as e:
        logger.warning(f"Error checking OpenAI config: {e}")
        checks["openai"] = "error"
    
    # Check storage
    try:
        from utils.storage import CONVERSATIONS_DIR
        if not os.path.exists(CONVERSATIONS_DIR):
            checks["storage"] = "error"
    except Exception as e:
        logger.warning(f"Error checking storage: {e}")
        checks["storage"] = "error"
    
    # Determine overall status
    status_code = 200
    if any(v == "error" for v in checks.values()):
        checks["status"] = "unhealthy"
        status_code = 503
    elif any(v == "not_configured" for v in checks.values()):
        checks["status"] = "degraded"
    
    return jsonify(checks), status_code


if __name__ == "__main__":
    app.run(debug=FLASK_DEBUG, host=FLASK_HOST, port=FLASK_PORT)
