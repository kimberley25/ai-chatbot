"""
Validation utilities for the chatbot application.
"""

import re
import uuid
from typing import Optional, Tuple


def validate_email(email: str) -> bool:
    """
    Validate email address format.
    
    Args:
        email: Email address to validate
    
    Returns:
        True if valid, False otherwise
    """
    if not email or not isinstance(email, str):
        return False
    
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(email_pattern, email.strip()))


def validate_conversation_id(conversation_id: str) -> bool:
    """
    Validate conversation ID format (UUID).
    
    Args:
        conversation_id: Conversation ID to validate
    
    Returns:
        True if valid UUID format, False otherwise
    """
    if not conversation_id or not isinstance(conversation_id, str):
        return False
    
    try:
        uuid.UUID(conversation_id)
        return True
    except (ValueError, AttributeError):
        return False


def validate_message(message: str, max_length: int = 10000) -> Tuple[bool, Optional[str]]:
    """
    Validate chat message.
    
    Args:
        message: Message to validate
        max_length: Maximum allowed message length
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not message or not isinstance(message, str):
        return False, "Message cannot be empty"
    
    message = message.strip()
    
    if not message:
        return False, "Message cannot be empty"
    
    if len(message) > max_length:
        return False, f"Message is too long. Please keep it under {max_length} characters."
    
    return True, None


def sanitize_input(text: str, max_length: int = 1000) -> str:
    """
    Sanitize user input by trimming and limiting length.
    
    Args:
        text: Text to sanitize
        max_length: Maximum length to allow
    
    Returns:
        Sanitized text
    """
    if not text or not isinstance(text, str):
        return ""
    
    # Trim whitespace
    text = text.strip()
    
    # Limit length
    if len(text) > max_length:
        text = text[:max_length]
    
    return text

