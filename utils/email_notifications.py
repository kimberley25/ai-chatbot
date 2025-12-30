"""
Email notification utilities for escalation handling.
Sends email notifications to users when escalations are created.
"""

import logging
from typing import Optional, Dict
from flask import Flask
from flask_mail import Mail, Message

logger = logging.getLogger(__name__)

# Global mail instance
mail = None


def init_mail(app: Flask):
    """Initialize Flask-Mail with the Flask app"""
    global mail
    mail = Mail(app)
    logger.info("Flask-Mail initialized")


def send_escalation_confirmation_email(
    recipient_email: str,
    recipient_name: str,
    priority: str = 'low'
) -> bool:
    """
    Send confirmation email to user when escalation is created.
    
    Args:
        recipient_email: User's email address
        recipient_name: User's name
        priority: Escalation priority ('low' or 'high')
        
    Returns:
        True if email sent successfully, False otherwise
    """
    if not mail:
        logger.error("Flask-Mail not initialized. Cannot send email.")
        return False
    
    if not recipient_email:
        logger.warning("No recipient email provided. Cannot send email.")
        return False
    
    try:
        from config import (
            MAIL_FROM_EMAIL,
            MAIL_FROM_NAME,
            MAIL_SUBJECT_LOW,
            MAIL_SUBJECT_HIGH
        )
        
        # Determine subject based on priority
        if priority == 'high':
            subject = MAIL_SUBJECT_HIGH or "Your Request Has Been Received - Strength Club"
            body = f"""
Dear {recipient_name},

Thank you for reaching out to Strength Club. We've received your request for immediate assistance, and our team is working to connect you with a coach as soon as possible.

A member of our team will be in touch with you shortly to discuss your needs and help you get started.

If you have any urgent questions in the meantime, please feel free to call us or reply to this email.

Best regards,
The Strength Club Team

---
Strength Club
hello@strengthclub.com.au
            """
        else:  # low priority
            subject = MAIL_SUBJECT_LOW or "Thank You for Your Interest - Strength Club"
            body = f"""
Dear {recipient_name},

Thank you for your interest in Strength Club coaching services. We've received your information and our team will be in touch with you soon to discuss how we can help you reach your goals.

We're excited to work with you and look forward to connecting!

Best regards,
The Strength Club Team

---
Strength Club
hello@strengthclub.com.au
            """
        
        msg = Message(
            subject=subject.strip(),
            recipients=[recipient_email],
            body=body.strip(),
            sender=(MAIL_FROM_NAME or "Strength Club", MAIL_FROM_EMAIL)
        )
        
        mail.send(msg)
        logger.info(f"Escalation confirmation email sent to {recipient_email} (priority: {priority})")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send escalation confirmation email to {recipient_email}: {e}")
        return False


def extract_email_from_text(text: str) -> Optional[str]:
    """
    Extract email address from text using regex.
    
    Args:
        text: Text to search for email address
        
    Returns:
        Email address if found, None otherwise
    """
    import re
    
    if not text:
        return None
    
    # Email regex pattern
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    match = re.search(email_pattern, text)
    
    if match:
        return match.group(0)
    return None


def extract_email_from_conversation(messages: list) -> Optional[str]:
    """
    Extract email address from conversation messages.
    Searches through user messages for email addresses.
    
    Args:
        messages: List of message dictionaries with 'role' and 'content' keys
        
    Returns:
        Email address if found, None otherwise
    """
    if not messages:
        return None
    
    # Search through user messages (most recent first)
    for msg in reversed(messages):
        if msg.get('role') == 'user':
            content = msg.get('content', '')
            email = extract_email_from_text(content)
            if email:
                return email
    
    return None

