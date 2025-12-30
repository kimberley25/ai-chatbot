# Escalation Feature Implementation Guide

## Overview

The escalation feature has been implemented to handle two types of escalations with email notifications:

1. **Low Priority Escalation**: Automatically created when the bot completes a handover confirmation (collects name, mobile, goal, plan). Email is extracted from conversation if available.
2. **High Priority Escalation**: Created when a user explicitly requests human assistance (e.g., "speak to human", "agent", "representative"). Requires email and issue/context from user.

Both escalation types send email confirmation notifications to users informing them that the team will be in touch.

## Architecture

### Components

1. **`utils/escalation_utils.py`**: Utility functions for extracting information from handover confirmation messages
2. **`utils/storage.py`**: Updated to support priority levels and additional fields in escalation records
3. **`utils/email_notifications.py`**: Email notification utilities for sending confirmation emails
4. **`app.py`**: Main Flask application with escalation detection, email extraction, and email sending
5. **`utils/chatbot.py`**: Enhanced escalation pattern detection
6. **`static/js/chat.js`**: Frontend improvements for goal/plan extraction, email/issue collection, and context extraction
7. **`templates/chat.html`**: Updated escalation modal with email and issue fields
8. **`config.py`**: Email configuration settings

## How It Works

### Low Priority Escalation (Handover Confirmation)

**Flow:**
1. Bot asks for name and mobile number during handover
2. User provides name and mobile
3. Bot responds with handover confirmation in this format:
   ```
   Name: [User's name]
   Mobile: [Contact number]
   Goal: [Primary goal]
   Plan: [Coaching option]
   ```
4. Backend detects this is a handover confirmation message
5. Backend extracts name, mobile, goal, and plan using regex patterns
6. Backend tries to extract email from conversation messages
7. Backend automatically creates a **low-priority escalation** record
8. If email found, backend sends **email confirmation** to user
9. Escalation is saved to `data/escalations/{conversation_id}_escalation.json`

**Detection:**
- Uses `is_handover_confirmation()` to check if message contains "Name:" and "Mobile:" fields
- Uses `extract_handover_info()` to extract all fields from the confirmation message

### High Priority Escalation (Immediate Help Request)

**Flow:**
1. User types phrases like:
   - "speak to human"
   - "speak to agent"
   - "speak to representative"
   - "talk to a person"
   - "I need human assistance"
   - etc.
2. Backend detects escalation pattern in user message
3. Backend returns `escalation_needed: true` to frontend
4. Frontend shows escalation modal to collect:
   - Name (required)
   - Mobile number (required)
   - Email address (required)
   - Issue/Context (required) - What they need help with
5. User fills in the form and submits
6. Frontend extracts goal and plan from conversation history
7. Frontend extracts conversation context (last 10 messages)
8. Frontend calls `/api/escalate` with contact info including email and issue
9. Backend creates a **high-priority escalation** record with issue/context
10. Backend sends **email notification** to user confirming their request
11. Backend also tries to extract goal/plan from handover confirmation if not provided

**Detection:**
- Uses regex patterns in `ChatBot.ESCALATION_PATTERNS` to detect user requests
- Patterns include variations of "speak to", "talk to", "need human", "want to speak", etc.

## Escalation Record Structure

Escalation records are saved as JSON files in `data/escalations/`:

**Low Priority Escalation:**
```json
{
  "conversation_id": "uuid-here",
  "timestamp": "2025-12-30T10:30:14.930504",
  "reason": "Handover confirmation - customer details collected",
  "contact_info": {
    "name": "John Doe",
    "mobile": "0123456789",
    "email": "john@example.com",
    "goal": "Competition prep",
    "plan": "Online coaching (Weekly)"
  },
  "priority": "low",
  "status": "pending"
}
```

**High Priority Escalation:**
```json
{
  "conversation_id": "uuid-here",
  "timestamp": "2025-12-30T10:30:14.930504",
  "reason": "Customer requested immediate human assistance",
  "contact_info": {
    "name": "Jane Doe",
    "mobile": "0987654321",
    "email": "jane@example.com",
    "goal": "Build strength",
    "plan": "Club coaching",
    "issue": "I have questions about injury management during training",
    "conversation_context": [...]
  },
  "priority": "high",
  "status": "pending"
}
```

**Key Fields:**
- `email`: User's email address (required for email notifications)
- `issue`: User's question/concern/context (high priority only)
- `conversation_context`: Recent conversation messages for context (high priority only)

## API Endpoints

### `/api/chat` (POST)
- Detects escalation patterns in user messages
- Detects handover confirmation in bot responses
- Creates low-priority escalations automatically
- Marks conversation as escalated when high-priority escalation is detected

### `/api/escalate` (POST)
- Creates high-priority escalation records
- Accepts contact_info with name, mobile, email, goal, plan, issue, conversation_context
- Extracts goal/plan from conversation if not provided
- Builds issue summary from conversation context if not provided
- Sends email notification to user
- Returns success confirmation

## Frontend Changes

### Enhanced Goal/Plan Extraction
- `extractGoalAndPlan()` now checks assistant messages for handover confirmation format first
- Falls back to keyword matching if handover format not found
- More accurate extraction for escalation submissions

### Escalation Modal
- Shows when `escalation_needed: true` is received
- Collects required information:
  - Name (required)
  - Mobile number (required)
  - Email address (required) - for notifications
  - Issue/Context (required) - what the user needs help with
- Automatically extracts goal and plan from conversation
- Extracts conversation context (last 10 messages)
- Submits to `/api/escalate` with all collected information

### New Functions
- `extractConversationContext()` - Extracts recent conversation messages for context

## Testing

### Test Low Priority Escalation
1. Start a conversation
2. Go through discovery flow
3. When bot asks for name and mobile, provide them
4. Bot should respond with handover confirmation
5. Check `data/escalations/` for new escalation file with `priority: "low"`

### Test High Priority Escalation
1. Start a conversation
2. Type "speak to human" or similar phrase
3. Escalation modal should appear
4. Fill in name and mobile
5. Submit form
6. Check `data/escalations/` for new escalation file with `priority: "high"`

## Email Notifications

### Configuration
Email notifications are configured via environment variables in `.env`:

```env
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=Strength Club
MAIL_SUBJECT_LOW=Thank You for Your Interest - Strength Club
MAIL_SUBJECT_HIGH=Your Request Has Been Received - Strength Club
```

### Email Flow
1. **Low Priority Escalations:**
   - System tries to extract email from conversation messages
   - If email found, sends confirmation email with thank you message
   - If email not found, escalation is still saved but no email is sent

2. **High Priority Escalations:**
   - Email is required in the escalation form
   - Always sends confirmation email when escalation is created
   - Email confirms request received and team will be in touch

### Email Content
- **Low Priority**: Thank you message, team will be in touch soon
- **High Priority**: Confirmation of immediate assistance request, team will contact shortly

## Files Modified

1. **New Files:**
   - `utils/escalation_utils.py` - Extraction utilities
   - `utils/email_notifications.py` - Email notification functions

2. **Modified Files:**
   - `utils/storage.py` - Added priority parameter and documentation for new fields
   - `app.py` - Added escalation detection, email extraction, and email sending
   - `utils/chatbot.py` - Enhanced escalation patterns
   - `static/js/chat.js` - Added email/issue collection and context extraction
   - `templates/chat.html` - Added email and issue fields to escalation modal
   - `static/css/chat.css` - Added form-help styling
   - `config.py` - Added email configuration
   - `requirements.txt` - Added flask-mail dependency

## Priority Levels

- **Low Priority**: Normal handover after discovery flow completion
- **High Priority**: Urgent requests when user explicitly asks for human assistance

## Installation & Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Email Settings
Add email configuration to your `.env` file:
```env
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=Strength Club
```

**Note:** For Gmail, you'll need to:
1. Enable 2-factor authentication
2. Generate an App Password (not your regular password)
3. Use the App Password in `MAIL_PASSWORD`

### 3. Test Email Notifications
1. Complete a discovery flow and provide email in conversation (low priority)
2. Or request human assistance and fill in escalation form with email (high priority)
3. Check email inbox for confirmation message

## Future Enhancements

Potential improvements:
- Add escalation status management (pending, in-progress, resolved)
- Add escalation dashboard for viewing all escalations
- Add internal email notifications to team for new escalations
- Add escalation history tracking
- Add priority-based sorting in escalation list
- Add email templates with HTML formatting
- Add email delivery tracking

