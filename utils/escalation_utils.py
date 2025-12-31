import re
from typing import Dict, Optional


def extract_handover_info(message: str) -> Optional[Dict[str, str]]:
    """
    Extract name, mobile, email, goal, and plan from handover confirmation message.

    Expected format:
    Name: [User's name]
    Mobile: [Contact number]
    Email: [Email address]
    Goal: [Primary goal]
    Plan: [Coaching option of interest]

    Args:
        message: The handover confirmation message from the assistant

    Returns:
        Dictionary with keys: name, mobile, email, goal, plan
        Returns None if extraction fails
    """
    if not message:
        return None

    # Pattern to match the handover format
    # Handles variations in spacing and formatting
    name_pattern = r"Name:\s*(.+?)(?:\n|Mobile:|$)"
    mobile_pattern = r"Mobile:\s*(.+?)(?:\n|Email:|Goal:|$)"
    email_pattern = r"Email:\s*(.+?)(?:\n|Goal:|$)"
    goal_pattern = r"Goal:\s*(.+?)(?:\n|Plan:|$)"
    plan_pattern = r"Plan:\s*(.+?)(?:\n|$)"

    extracted = {}

    # Extract name
    name_match = re.search(name_pattern, message, re.IGNORECASE | re.MULTILINE)
    if name_match:
        extracted["name"] = name_match.group(1).strip()

    # Extract mobile
    mobile_match = re.search(mobile_pattern, message, re.IGNORECASE | re.MULTILINE)
    if mobile_match:
        extracted["mobile"] = mobile_match.group(1).strip()

    # Extract email
    email_match = re.search(email_pattern, message, re.IGNORECASE | re.MULTILINE)
    if email_match:
        extracted["email"] = email_match.group(1).strip()

    # Extract goal
    goal_match = re.search(goal_pattern, message, re.IGNORECASE | re.MULTILINE)
    if goal_match:
        extracted["goal"] = goal_match.group(1).strip()

    # Extract plan
    plan_match = re.search(plan_pattern, message, re.IGNORECASE | re.MULTILINE)
    if plan_match:
        extracted["plan"] = plan_match.group(1).strip()

    # Return None if we don't have at least name and mobile (required fields)
    if "name" not in extracted or "mobile" not in extracted:
        return None

    return extracted


def is_handover_confirmation(message: str) -> bool:
    """
    Check if a message is a handover confirmation message.

    Args:
        message: The message to check

    Returns:
        True if the message appears to be a handover confirmation
    """
    if not message:
        return False

    # Check for the handover format pattern
    # Must contain "Name:" and "Mobile:" at minimum
    has_name = re.search(r"Name:\s*.+", message, re.IGNORECASE)
    has_mobile = re.search(r"Mobile:\s*.+", message, re.IGNORECASE)
    has_email = re.search(r"Email:\s*.+", message, re.IGNORECASE)

    return bool(has_name and has_mobile)
