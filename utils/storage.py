"""
Storage layer for chatbot application.
Handles JSON-based file storage for conversations, escalations, and users.
"""

import os
import json
from datetime import datetime, timedelta
from pathlib import Path


# Directory constants
DATA_DIR = 'data'
CONVERSATIONS_DIR = os.path.join(DATA_DIR, 'conversations')
ESCALATIONS_DIR = os.path.join(DATA_DIR, 'escalations')
USERS_DIR = os.path.join(DATA_DIR, 'users')


def _ensure_dir_exists(directory):
    """Create directory if it doesn't exist"""
    os.makedirs(directory, exist_ok=True)


def _get_file_path(directory, file_id, suffix=''):
    """Build file path consistently"""
    filename = f"{file_id}{suffix}.json"
    return os.path.join(directory, filename)


def _load_json_file(file_path):
    """Load JSON file safely, return None if file doesn't exist or is corrupted"""
    if not os.path.exists(file_path):
        return None
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading file {file_path}: {e}")
        return None


def _save_json_file(file_path, data):
    """Save data to JSON file"""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except IOError as e:
        print(f"Error saving file {file_path}: {e}")
        return False


# Initialize directories on import
_ensure_dir_exists(CONVERSATIONS_DIR)
_ensure_dir_exists(ESCALATIONS_DIR)
_ensure_dir_exists(USERS_DIR)


# ============================================================================
# CONVERSATION FUNCTIONS
# ============================================================================

def save_conversation(conversation_id, messages, escalated=False, title=None):
    """
    Save conversation to file.
    
    Args:
        conversation_id: Unique identifier for the conversation
        messages: List of message dictionaries
        escalated: Boolean indicating if conversation is escalated
        title: Optional title for the conversation
    
    Returns:
        Dictionary containing conversation data, or None on error
    """
    file_path = _get_file_path(CONVERSATIONS_DIR, conversation_id)
    
    # Load existing conversation to preserve created_at and title
    existing_data = _load_json_file(file_path)
    
    if existing_data:
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
                if msg.get('role') == 'user':
                    # Use first 50 chars of first user message as title
                    content = msg.get('content', '')
                    title = content[:50] + ('...' if len(content) > 50 else '')
                    break
    
    conversation_data = {
        'id': conversation_id,
        'created_at': created_at,
        'updated_at': datetime.now().isoformat(),
        'title': title,
        'messages': messages,
        'escalated': escalated
    }
    
    if _save_json_file(file_path, conversation_data):
        return conversation_data
    return None


def load_conversation(conversation_id):
    """
    Load conversation from file.
    
    Args:
        conversation_id: Unique identifier for the conversation
    
    Returns:
        Dictionary containing conversation data, or None if not found
    """
    file_path = _get_file_path(CONVERSATIONS_DIR, conversation_id)
    return _load_json_file(file_path)


def list_conversations():
    """
    List all saved conversations.
    
    Returns:
        List of conversation summary dictionaries, sorted by updated_at (most recent first)
    """
    conversations = []
    
    if not os.path.exists(CONVERSATIONS_DIR):
        return conversations
    
    for filename in os.listdir(CONVERSATIONS_DIR):
        if filename.endswith('.json'):
            file_path = os.path.join(CONVERSATIONS_DIR, filename)
            data = _load_json_file(file_path)
            
            if data:
                # Return summary info only
                conversations.append({
                    'id': data.get('id'),
                    'title': data.get('title', 'New Chat'),
                    'created_at': data.get('created_at'),
                    'updated_at': data.get('updated_at'),
                    'escalated': data.get('escalated', False),
                    'message_count': len([m for m in data.get('messages', []) if m.get('role') != 'system'])
                })
    
    # Sort by updated_at (most recent first)
    conversations.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
    return conversations


def delete_conversation(conversation_id):
    """
    Delete a conversation file.
    
    Args:
        conversation_id: Unique identifier for the conversation
    
    Returns:
        True if deleted successfully, False otherwise
    """
    file_path = _get_file_path(CONVERSATIONS_DIR, conversation_id)
    
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except OSError as e:
        print(f"Error deleting conversation {conversation_id}: {e}")
        return False


# ============================================================================
# ESCALATION FUNCTIONS
# ============================================================================

def save_escalation(conversation_id, reason, contact_info):
    """
    Save escalation request.
    
    Args:
        conversation_id: Unique identifier for the conversation
        reason: Reason for escalation
        contact_info: Dictionary containing user contact information
    
    Returns:
        Dictionary containing escalation data, or None on error
    """
    escalation_data = {
        'conversation_id': conversation_id,
        'timestamp': datetime.now().isoformat(),
        'reason': reason,
        'contact_info': contact_info,
        'status': 'pending'
    }
    
    file_path = _get_file_path(ESCALATIONS_DIR, conversation_id, '_escalation')
    
    if _save_json_file(file_path, escalation_data):
        return escalation_data
    return None


def load_escalation(conversation_id):
    """
    Load escalation by conversation ID.
    
    Args:
        conversation_id: Unique identifier for the conversation
    
    Returns:
        Dictionary containing escalation data, or None if not found
    """
    file_path = _get_file_path(ESCALATIONS_DIR, conversation_id, '_escalation')
    return _load_json_file(file_path)


def list_escalations():
    """
    List all escalations.
    
    Returns:
        List of escalation dictionaries, sorted by timestamp (most recent first)
    """
    escalations = []
    
    if not os.path.exists(ESCALATIONS_DIR):
        return escalations
    
    for filename in os.listdir(ESCALATIONS_DIR):
        if filename.endswith('_escalation.json'):
            file_path = os.path.join(ESCALATIONS_DIR, filename)
            data = _load_json_file(file_path)
            
            if data:
                escalations.append(data)
    
    # Sort by timestamp (most recent first)
    escalations.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return escalations


# ============================================================================
# USER FUNCTIONS
# ============================================================================

def save_user(user_id, user_data):
    """
    Save user profile.
    
    Args:
        user_id: Unique identifier for the user
        user_data: Dictionary containing user information (email, name, etc.)
    
    Returns:
        Dictionary containing user data, or None on error
    """
    file_path = _get_file_path(USERS_DIR, user_id)
    
    # Load existing user to preserve created_at
    existing_data = _load_json_file(file_path)
    
    user_profile = {
        'user_id': user_id,
        'created_at': existing_data.get('created_at', datetime.now().isoformat()) if existing_data else datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
        **user_data
    }
    
    if _save_json_file(file_path, user_profile):
        return user_profile
    return None


def load_user(user_id):
    """
    Load user profile.
    
    Args:
        user_id: Unique identifier for the user
    
    Returns:
        Dictionary containing user data, or None if not found
    """
    file_path = _get_file_path(USERS_DIR, user_id)
    return _load_json_file(file_path)


def update_user(user_id, updates):
    """
    Update user profile with new data.
    
    Args:
        user_id: Unique identifier for the user
        updates: Dictionary containing fields to update
    
    Returns:
        Updated user dictionary, or None if user not found or error occurred
    """
    existing_data = load_user(user_id)
    
    if not existing_data:
        return None
    
    # Merge updates
    existing_data.update(updates)
    existing_data['updated_at'] = datetime.now().isoformat()
    
    file_path = _get_file_path(USERS_DIR, user_id)
    
    if _save_json_file(file_path, existing_data):
        return existing_data
    return None


def delete_user(user_id):
    """
    Delete user profile.
    
    Args:
        user_id: Unique identifier for the user
    
    Returns:
        True if deleted successfully, False otherwise
    """
    file_path = _get_file_path(USERS_DIR, user_id)
    
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except OSError as e:
        print(f"Error deleting user {user_id}: {e}")
        return False


# ============================================================================
# CLEANUP FUNCTIONS
# ============================================================================

def cleanup_old_sessions(timeout_hours=24):
    """
    Remove old conversation sessions that haven't been updated within timeout period.
    
    Args:
        timeout_hours: Number of hours after which a session is considered old (default: 24)
    
    Returns:
        Dictionary with cleanup statistics: {'deleted': count, 'errors': count}
    """
    deleted_count = 0
    error_count = 0
    timeout_threshold = datetime.now() - timedelta(hours=timeout_hours)
    
    if not os.path.exists(CONVERSATIONS_DIR):
        return {'deleted': 0, 'errors': 0}
    
    for filename in os.listdir(CONVERSATIONS_DIR):
        if filename.endswith('.json'):
            file_path = os.path.join(CONVERSATIONS_DIR, filename)
            data = _load_json_file(file_path)
            
            if data:
                updated_at_str = data.get('updated_at')
                if updated_at_str:
                    try:
                        updated_at = datetime.fromisoformat(updated_at_str)
                        if updated_at < timeout_threshold:
                            if delete_conversation(data.get('id')):
                                deleted_count += 1
                            else:
                                error_count += 1
                    except (ValueError, TypeError) as e:
                        print(f"Error parsing timestamp for {filename}: {e}")
                        error_count += 1
    
    return {'deleted': deleted_count, 'errors': error_count}