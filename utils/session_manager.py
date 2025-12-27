"""
Session management utilities for chatbot application.
Handles session lifecycle, expiration, and cleanup.
"""

from datetime import datetime, timedelta
from flask import session
import uuid


class SessionManager:
    """Manages Flask session lifecycle and state"""
    
    def __init__(self, session_lifetime_hours=24):
        self.session_lifetime_hours = session_lifetime_hours
    
    def init_session(self):
        """Initialize a new session if one doesn't exist"""
        if 'session_id' not in session:
            session['session_id'] = str(uuid.uuid4())
            session['created_at'] = datetime.now().isoformat()
            session['last_activity'] = datetime.now().isoformat()
            session['conversation_id'] = None
        else:
            # Update last activity timestamp
            session['last_activity'] = datetime.now().isoformat()
    
    def is_session_valid(self):
        """Check if current session is still valid (not expired)"""
        if 'last_activity' not in session:
            return False
        
        try:
            last_activity = datetime.fromisoformat(session['last_activity'])
            expiration_time = last_activity + timedelta(hours=self.session_lifetime_hours)
            return datetime.now() < expiration_time
        except (ValueError, TypeError):
            return False
    
    def extend_session(self):
        """Extend session lifetime by updating last activity"""
        if 'session_id' in session:
            session['last_activity'] = datetime.now().isoformat()
    
    def set_conversation(self, conversation_id):
        """Associate a conversation with the current session"""
        session['conversation_id'] = conversation_id
        self.extend_session()
    
    def get_conversation_id(self):
        """Get the current conversation ID from session"""
        return session.get('conversation_id')
    
    def clear_conversation(self):
        """Clear conversation from session but keep session active"""
        session.pop('conversation_id', None)
    
    def clear_session(self):
        """Clear all session data"""
        session.clear()
    
    def get_session_info(self):
        """Get current session information"""
        return {
            'session_id': session.get('session_id'),
            'conversation_id': session.get('conversation_id'),
            'created_at': session.get('created_at'),
            'last_activity': session.get('last_activity')
        }


# Global session manager instance
session_manager = SessionManager()