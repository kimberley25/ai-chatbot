import logging
from typing import Optional
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
    recipient_email: str, recipient_name: str, priority: str = "low"
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
            MAIL_SERVER,
            MAIL_PORT,
            MAIL_USERNAME,
            MAIL_PASSWORD,
        )

        # Validate email configuration
        if not MAIL_FROM_EMAIL:
            logger.error("MAIL_FROM_EMAIL is not configured. Cannot send email.")
            return False

        if not MAIL_SERVER:
            logger.error("MAIL_SERVER is not configured. Cannot send email.")
            return False

        if not MAIL_USERNAME or not MAIL_PASSWORD:
            logger.warning(
                f"MAIL_USERNAME or MAIL_PASSWORD not configured. Email may fail if authentication is required."
            )

        if priority == "high":
            subject = "Strength Club – We’ve Received Your Enquiry"
            body = f"""
Dear {recipient_name},

Thank you for reaching out to Strength Club and for taking the time to share your details with us. We’ve received your enquiry, and one of our coaches will be in touch shortly to arrange your follow-up consult and discuss how we can best support your goals.

If you have any questions in the meantime, feel free to reply to this email — we’re happy to help.

Yours in strength,  
Strength Club
hello@strengthclub.com.au
            """
        else:
            subject = "Thanks for Your Interest in Strength Club"
            body = f"""
Dear {recipient_name},

Thank you for your interest in Strength Club. We’ve received your details, and our team will be in touch shortly to discuss your goals and how we can best support you.

If you have any questions in the meantime, feel free to reply to this email.

Yours in strength,  
Strength Club
hello@strengthclub.com.au
            """

        msg = Message(
            subject=subject.strip(),
            recipients=[recipient_email],
            body=body.strip(),
            sender=(MAIL_FROM_NAME or "Strength Club", MAIL_FROM_EMAIL),
        )

        # Flask-Mail needs to be called within application context
        # Since we're already in a Flask route, the context should exist
        # But let's add explicit error handling
        try:
            mail.send(msg)
            logger.info(
                f"Escalation confirmation email sent successfully to {recipient_email} (priority: {priority})"
            )
            return True
        except Exception as send_error:
            logger.error(
                f"Flask-Mail send() failed for {recipient_email}: {send_error}",
                exc_info=True,
            )
            # Log SMTP configuration for debugging
            from config import (
                MAIL_SERVER,
                MAIL_PORT,
                MAIL_USERNAME,
                MAIL_USE_TLS,
                MAIL_USE_SSL,
            )

            logger.error(
                f"SMTP Config - Server: {MAIL_SERVER}, Port: {MAIL_PORT}, "
                f"TLS: {MAIL_USE_TLS}, SSL: {MAIL_USE_SSL}, "
                f"Username: {MAIL_USERNAME}, From: {MAIL_FROM_EMAIL}"
            )
            raise  # Re-raise to be caught by outer exception handler

    except ImportError as e:
        logger.error(
            f"Failed to import email configuration: {e}. Check config.py for MAIL_FROM_EMAIL and MAIL_FROM_NAME."
        )
        return False
    except Exception as e:
        logger.error(
            f"Failed to send escalation confirmation email to {recipient_email}: {e}",
            exc_info=True,
        )
        # Log additional details for debugging
        from config import MAIL_SERVER, MAIL_PORT, MAIL_USERNAME

        logger.debug(
            f"Email config - Server: {MAIL_SERVER}, Port: {MAIL_PORT}, "
            f"Username: {MAIL_USERNAME}, From: {MAIL_FROM_EMAIL}"
        )
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
    email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
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
        if msg.get("role") == "user":
            content = msg.get("content", "")
            email = extract_email_from_text(content)
            if email:
                return email

    return None
