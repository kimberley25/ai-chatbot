from flask import Flask, render_template, request, jsonify, session
from openai import OpenAI
import uuid
import json
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Initialize OpenAI client
client = OpenAI(
    api_key=os.getenv('OPENAI_API_KEY')
)

# Store active sessions in memory (in production, use Redis or database)
chat_sessions = {}

# System prompt for the company chatbot
# Link system prompt

# Ensure data directories exist
os.makedirs('data/conversations', exist_ok=True)
os.makedirs('data/escalations', exist_ok=True)


def save_conversation(conversation_id, messages, escalated=False, title=None):
    """Save conversation to file"""
    file_path = f'data/conversations/{conversation_id}.json'
    
    # Load existing conversation to preserve created_at and title
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            existing_data = json.load(f)
            created_at = existing_data.get('created_at', datetime.now().isoformat())
            existing_title = existing_data.get('title', 'New Chat')
    else:
        created_at = datetime.now().isoformat()
        existing_title = 'New Chat'
    
    # Generate title from first user message if not provided
    if title is None:
        title = existing_title
        if title == 'New Chat' and len(messages) > 1:
            for msg in messages:
                if msg['role'] == 'user':
                    # Use first 50 chars of first user message as title
                    title = msg['content'][:50] + ('...' if len(msg['content']) > 50 else '')
                    break
    
    conversation_data = {
        'id': conversation_id,
        'created_at': created_at,
        'updated_at': datetime.now().isoformat(),
        'title': title,
        'messages': messages,
        'escalated': escalated
    }
    
    with open(file_path, 'w') as f:
        json.dump(conversation_data, f, indent=2)
    
    return conversation_data


def load_conversation(conversation_id):
    """Load conversation from file"""
    file_path = f'data/conversations/{conversation_id}.json'
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            data = json.load(f)
            # Load into memory if not already there
            if conversation_id not in chat_sessions:
                chat_sessions[conversation_id] = {
                    'messages': data['messages'],
                    'escalated': data.get('escalated', False)
                }
            return data
    return None


def list_all_conversations():
    """List all saved conversations"""
    conversations = []
    conv_dir = 'data/conversations'
    
    if os.path.exists(conv_dir):
        for filename in os.listdir(conv_dir):
            if filename.endswith('.json'):
                file_path = os.path.join(conv_dir, filename)
                try:
                    with open(file_path, 'r') as f:
                        data = json.load(f)
                        # Return summary info only
                        conversations.append({
                            'id': data['id'],
                            'title': data.get('title', 'New Chat'),
                            'created_at': data.get('created_at'),
                            'updated_at': data.get('updated_at'),
                            'escalated': data.get('escalated', False),
                            'message_count': len([m for m in data['messages'] if m['role'] != 'system'])
                        })
                except Exception as e:
                    print(f"Error loading conversation {filename}: {e}")
    
    # Sort by updated_at (most recent first)
    conversations.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
    return conversations


def save_escalation(conversation_id, reason, contact_info):
    """Save escalation request"""
    escalation_data = {
        'conversation_id': conversation_id,
        'timestamp': datetime.now().isoformat(),
        'reason': reason,
        'contact_info': contact_info,
        'status': 'pending'
    }
    
    escalation_file = f'data/escalations/{conversation_id}_escalation.json'
    with open(escalation_file, 'w') as f:
        json.dump(escalation_data, f, indent=2)
    
    return escalation_data


@app.route('/')
def index():
    """Render the main chat interface"""
    return render_template('index.html')


@app.route('/api/start_session', methods=['POST'])
def start_session():
    """Initialize a new chat session"""
    data = request.json or {}
    load_existing = data.get('load_existing', False)
    conversation_id = data.get('conversation_id')
    
    if load_existing and conversation_id:
        # Load existing conversation
        conv_data = load_conversation(conversation_id)
        if conv_data:
            session['conversation_id'] = conversation_id
            return jsonify({
                'success': True,
                'conversation_id': conversation_id,
                'loaded': True,
                'title': conv_data.get('title', 'New Chat'),
                'messages': [m for m in conv_data['messages'] if m['role'] != 'system'],
                'escalated': conv_data.get('escalated', False)
            })
    
    # Create new conversation
    conversation_id = str(uuid.uuid4())
    session['conversation_id'] = conversation_id
    
    # Initialize conversation with system prompt
    chat_sessions[conversation_id] = {
        'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}],
        'escalated': False
    }
    
    # Save initial conversation
    save_conversation(conversation_id, chat_sessions[conversation_id]['messages'], False)
    
    return jsonify({
        'success': True,
        'conversation_id': conversation_id,
        'loaded': False,
        'welcome_message': "Hello! I'm here to help you with any questions about TechServe Solutions. How can I assist you today?"
    })


@app.route('/api/send_message', methods=['POST'])
def send_message():
    """Handle incoming chat messages"""
    data = request.json
    user_message = data.get('message', '').strip()
    conversation_id = session.get('conversation_id')
    
    if not conversation_id or not user_message:
        return jsonify({'success': False, 'error': 'Invalid request'}), 400
    
    # Get or load session from file if not in memory
    if conversation_id not in chat_sessions:
        conv_data = load_conversation(conversation_id)
        if conv_data:
            chat_sessions[conversation_id] = {
                'messages': conv_data['messages'],
                'escalated': conv_data.get('escalated', False)
            }
        else:
            chat_sessions[conversation_id] = {
                'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}],
                'escalated': False
            }
    
    # Check if already escalated
    if chat_sessions[conversation_id]['escalated']:
        return jsonify({
            'success': True,
            'message': "Your request has been escalated to our team. A representative will contact you shortly.",
            'escalated': True
        })
    
    # Add user message
    chat_sessions[conversation_id]['messages'].append({
        'role': 'user',
        'content': user_message
    })
    
    try:
        # Get AI response
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=chat_sessions[conversation_id]['messages'],
            temperature=0.7,
            max_tokens=500
        )
        
        bot_reply = response.choices[0].message.content
        
        # Add assistant message
        chat_sessions[conversation_id]['messages'].append({
            'role': 'assistant',
            'content': bot_reply
        })
        
        # Save conversation
        save_conversation(
            conversation_id,
            chat_sessions[conversation_id]['messages'],
            chat_sessions[conversation_id]['escalated']
        )
        
        return jsonify({
            'success': True,
            'message': bot_reply
        })
        
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get response. Please try again.'
        }), 500


@app.route('/api/escalate', methods=['POST'])
def escalate_to_human():
    """Escalate conversation to human support"""
    data = request.json
    conversation_id = session.get('conversation_id')
    reason = data.get('reason', 'Customer requested human assistance')
    contact_info = data.get('contact_info', {})
    
    if not conversation_id:
        return jsonify({'success': False, 'error': 'No active conversation'}), 400
    
    # Mark session as escalated
    if conversation_id in chat_sessions:
        chat_sessions[conversation_id]['escalated'] = True
        
        # Save escalation
        save_escalation(conversation_id, reason, contact_info)
        
        # Save updated conversation
        save_conversation(
            conversation_id,
            chat_sessions[conversation_id]['messages'],
            escalated=True
        )
    
    return jsonify({
        'success': True,
        'message': 'Your conversation has been escalated to our support team. A representative will contact you within 24 hours.'
    })


@app.route('/api/get_history', methods=['GET'])
def get_history():
    """Get conversation history for current session"""
    conversation_id = session.get('conversation_id')
    
    if not conversation_id:
        return jsonify({'success': False, 'error': 'No active conversation'}), 400
    
    if conversation_id in chat_sessions:
        # Return only user and assistant messages (not system)
        messages = [
            msg for msg in chat_sessions[conversation_id]['messages']
            if msg['role'] != 'system'
        ]
        return jsonify({
            'success': True,
            'messages': messages,
            'escalated': chat_sessions[conversation_id]['escalated']
        })
    
    return jsonify({'success': True, 'messages': [], 'escalated': False})


@app.route('/api/list_conversations', methods=['GET'])
def list_conversations():
    """List all conversations"""
    conversations = list_all_conversations()
    return jsonify({
        'success': True,
        'conversations': conversations
    })


@app.route('/api/delete_conversation', methods=['POST'])
def delete_conversation():
    """Delete a conversation"""
    data = request.json
    conversation_id = data.get('conversation_id')
    
    if not conversation_id:
        return jsonify({'success': False, 'error': 'No conversation ID provided'}), 400
    
    file_path = f'data/conversations/{conversation_id}.json'
    
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            # Remove from memory if loaded
            if conversation_id in chat_sessions:
                del chat_sessions[conversation_id]
            
            # If this was the active conversation, clear session
            if session.get('conversation_id') == conversation_id:
                session.pop('conversation_id', None)
            
            return jsonify({'success': True, 'message': 'Conversation deleted'})
        else:
            return jsonify({'success': False, 'error': 'Conversation not found'}), 404
    except Exception as e:
        print(f"Error deleting conversation: {e}")
        return jsonify({'success': False, 'error': 'Failed to delete conversation'}), 500


@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)


