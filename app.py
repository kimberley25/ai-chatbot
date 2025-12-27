from flask import Flask, render_template, request, jsonify, session, g
import uuid
from datetime import timedelta

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
    list_conversations,
    delete_conversation as storage_delete_conversation,
    save_escalation,
)
from utils.session_manager import session_manager
from utils.chatbot import ChatBot

app = Flask(__name__)

# Configure Flask session
app.secret_key = FLASK_SECRET_KEY
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=SESSION_LIFETIME_HOURS)
app.config["SESSION_COOKIE_SECURE"] = SESSION_COOKIE_SECURE
app.config["SESSION_COOKIE_HTTPONLY"] = SESSION_COOKIE_HTTPONLY
app.config["SESSION_COOKIE_SAMESITE"] = SESSION_COOKIE_SAMESITE

# Initialize chatbot instance
chatbot = ChatBot()
chat_sessions = {}


@app.before_request
def before_request():
    """Initialize session before each request"""
    # Initialize session if needed
    session_manager.init_session()

    # Check if session is valid
    if not session_manager.is_session_valid():
        # Session expired - clear it
        session_manager.clear_session()
        session_manager.init_session()

    # Make session permanent if configured
    if SESSION_PERMANENT:
        session.permanent = True

    # Store session manager in g for easy access
    g.session_manager = session_manager


@app.route("/")
def index():
    """Render the main chat interface"""
    return render_template("index.html")


@app.route("/api/start_session", methods=["POST"])
def start_session():
    """Initialize a new chat session"""
    data = request.json or {}
    load_existing = data.get("load_existing", False)
    conversation_id = data.get("conversation_id")

    if load_existing and conversation_id:
        # Load existing conversation
        conv_data = load_conversation(conversation_id)
        if conv_data:
            session_manager.set_conversation(conversation_id)
            # Load into memory cache
            if conversation_id not in chat_sessions:
                chat_sessions[conversation_id] = {
                    "messages": conv_data["messages"],
                    "escalated": conv_data.get("escalated", False),
                }
            return jsonify(
                {
                    "success": True,
                    "conversation_id": conversation_id,
                    "loaded": True,
                    "title": conv_data.get("title", "New Chat"),
                    "messages": [
                        m for m in conv_data["messages"] if m["role"] != "system"
                    ],
                    "escalated": conv_data.get("escalated", False),
                }
            )

    # Create new conversation
    conversation_id = str(uuid.uuid4())
    session_manager.set_conversation(conversation_id)

    # Initialize conversation with system prompt
    chat_sessions[conversation_id] = {
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}],
        "escalated": False,
    }

    # Save initial conversation
    save_conversation(
        conversation_id, chat_sessions[conversation_id]["messages"], False
    )

    return jsonify(
        {
            "success": True,
            "conversation_id": conversation_id,
            "loaded": False,
            "welcome_message": "Welcome to Strength Culture! I’m here if you have any questions about training, nutrition, or coaching. What can I help you with today?",
        }
    )


@app.route("/api/send_message", methods=["POST"])
def send_message():
    """Handle incoming chat messages"""
    data = request.json
    user_message = data.get("message", "").strip()
    conversation_id = session_manager.get_conversation_id()

    if not conversation_id or not user_message:
        return jsonify({"success": False, "error": "Invalid request"}), 400

    # Extend session on activity
    session_manager.extend_session()

    # Get or load session from file if not in memory
    if conversation_id not in chat_sessions:
        conv_data = load_conversation(conversation_id)
        if conv_data:
            chat_sessions[conversation_id] = {
                "messages": conv_data["messages"],
                "escalated": conv_data.get("escalated", False),
            }
        else:
            chat_sessions[conversation_id] = {
                "messages": [{"role": "system", "content": SYSTEM_PROMPT}],
                "escalated": False,
            }

    # Check if already escalated
    if chat_sessions[conversation_id]["escalated"]:
        return jsonify(
            {
                "success": True,
                "message": "Your request has been escalated to our team. A representative will contact you shortly.",
                "escalated": True,
            }
        )

    # Add user message
    chat_sessions[conversation_id]["messages"].append(
        {"role": "user", "content": user_message}
    )

    try:
        # Get AI response and escalation flag
        bot_reply, escalation_detected = chatbot.get_response(
            chat_sessions[conversation_id]["messages"], user_message=user_message
        )

        # Add assistant message
        chat_sessions[conversation_id]["messages"].append(
            {"role": "assistant", "content": bot_reply}
        )

        # Handle escalation if detected
        if escalation_detected:
            chat_sessions[conversation_id]["escalated"] = True
            # Save escalation record
            save_escalation(conversation_id, "Escalation detected automatically", {})

        # Save conversation
        save_conversation(
            conversation_id,
            chat_sessions[conversation_id]["messages"],
            chat_sessions[conversation_id]["escalated"],
        )

        return jsonify(
            {"success": True, "message": bot_reply, "escalated": escalation_detected}
        )

    except Exception as e:
        print(f"Error: {e}")
        return (
            jsonify(
                {"success": False, "error": "Failed to get response. Please try again."}
            ),
            500,
        )


@app.route("/api/escalate", methods=["POST"])
def escalate_to_human():
    """Escalate conversation to human support"""
    data = request.json
    conversation_id = session_manager.get_conversation_id()
    reason = data.get("reason", "Customer requested human assistance")
    contact_info = data.get("contact_info", {})

    if not conversation_id:
        return jsonify({"success": False, "error": "No active conversation"}), 400

    # Mark session as escalated
    if conversation_id in chat_sessions:
        chat_sessions[conversation_id]["escalated"] = True

        # Save escalation
        save_escalation(conversation_id, reason, contact_info)

        # Save updated conversation
        save_conversation(
            conversation_id, chat_sessions[conversation_id]["messages"], escalated=True
        )

    return jsonify(
        {
            "success": True,
            "message": "Your conversation has been escalated to our support team. A representative will contact you within 24 hours.",
        }
    )


@app.route("/api/get_history", methods=["GET"])
def get_history():
    """Get conversation history for current session"""
    conversation_id = session_manager.get_conversation_id()

    if not conversation_id:
        return jsonify({"success": False, "error": "No active conversation"}), 400

    if conversation_id in chat_sessions:
        # Return only user and assistant messages (not system)
        messages = [
            msg
            for msg in chat_sessions[conversation_id]["messages"]
            if msg["role"] != "system"
        ]
        return jsonify(
            {
                "success": True,
                "messages": messages,
                "escalated": chat_sessions[conversation_id]["escalated"],
            }
        )

    return jsonify({"success": True, "messages": [], "escalated": False})


@app.route("/api/list_conversations", methods=["GET"])
def list_conversations():
    """List all conversations"""
    conversations = list_conversations()
    return jsonify({"success": True, "conversations": conversations})


@app.route("/api/delete_conversation", methods=["POST"])
def delete_conversation():
    """Delete a conversation"""
    data = request.json
    conversation_id = data.get("conversation_id")

    if not conversation_id:
        return jsonify({"success": False, "error": "No conversation ID provided"}), 400

    # Delete from storage
    if storage_delete_conversation(conversation_id):
        # Remove from memory if loaded
        if conversation_id in chat_sessions:
            del chat_sessions[conversation_id]

        # If this was the active conversation, clear it from session
        if session_manager.get_conversation_id() == conversation_id:
            session_manager.clear_conversation()

        return jsonify({"success": True, "message": "Conversation deleted"})
    else:
        return jsonify({"success": False, "error": "Conversation not found"}), 404


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
    """Health check endpoint"""
    return jsonify({"status": "healthy"})


if __name__ == "__main__":
    app.run(debug=FLASK_DEBUG, host=FLASK_HOST, port=FLASK_PORT)
