# Strength Club Chatbot

A Flask-based AI chatbot for Strength Club that helps users discover coaching services through guided conversations and facilitates escalation to human coaches with email notifications.

## Table of Contents

- [Features](#features)
- [Setup](#setup)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

## Features

### Core Features
- **AI-Powered Conversations** - OpenAI GPT integration for intelligent, context-aware responses
- **Discovery Flows** - Guided questions for Strength/Powerlifting, Competition Prep, and Nutrition coaching
- **Session Management** - Persistent sessions with automatic expiration and cleanup
- **Conversation History** - View and manage past conversations
- **Modern UI** - Clean chat interface with discovery chips, typing indicators, and suggestion buttons

### Escalation System
- **Automatic Escalation Detection** - Detects when users request human assistance
- **Two Priority Levels**:
  - **Low Priority**: Automatic escalation after handover confirmation (name, mobile, email, goal, plan collected)
  - **High Priority**: Immediate escalation when user explicitly requests human help
- **Email Notifications** - Automatic confirmation emails sent to users when escalations are created
- **Contact Information Collection** - Escalation modal collects name, mobile, email, and issue details

### Data Management
- **JSON-based Storage** - Conversations, escalations, and user data stored as JSON files
- **Conversation Persistence** - Conversations saved automatically and can be reloaded
- **Escalation Tracking** - All escalations saved with priority, status, and contact information

## Setup

### Prerequisites
- Python 3.7+
- OpenAI API key
- Email account (for notifications - optional but recommended)

### Installation

1. **Clone or download the repository**

2. **Create virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create `.env` file** in project root:
   ```env
   # Required
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Optional - Flask Configuration
   FLASK_RUN_HOST=0.0.0.0
   FLASK_RUN_PORT=5001
   FLASK_DEBUG=True
   FLASK_SECRET_KEY=your-secret-key-here  # Auto-generated if not set
   
   # Optional - OpenAI Configuration
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_TEMPERATURE=0.7
   OPENAI_MAX_TOKENS=300
   OPENAI_FREQUENCY_PENALTY=0
   OPENAI_PRESENCE_PENALTY=0
   
   # Optional - Session Configuration
   SESSION_PERMANENT=False
   SESSION_LIFETIME_HOURS=24
   SESSION_COOKIE_SECURE=False  # Set to True in production with HTTPS
   SESSION_COOKIE_HTTPONLY=True
   SESSION_COOKIE_SAMESITE=Lax
   SESSION_CLEANUP_INTERVAL_MINUTES=60
   
   # Optional - Email Configuration (for notifications)
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USE_TLS=True
   MAIL_USE_SSL=False
   MAIL_USERNAME=your-email@gmail.com
   MAIL_PASSWORD=your-app-password
   MAIL_FROM_EMAIL=your-email@gmail.com
   MAIL_FROM_NAME=Strength Club
   MAIL_SUBJECT_LOW=Thank You for Your Interest - Strength Club
   MAIL_SUBJECT_HIGH=Your Request Has Been Received - Strength Club
   
   # Optional - System Prompt Configuration
   SYSTEM_PROMPT_DIR=prompts
   ```

5. **Run the application**
   ```bash
   python app.py
   ```

6. **Open in browser**: `http://localhost:5001`

### Email Setup (Optional)

For email notifications to work:

1. **Gmail Setup**:
   - Enable 2-factor authentication on your Google account
   - Generate an App Password: Google Account → Security → 2-Step Verification → App passwords
   - Use the App Password (not your regular password) in `MAIL_PASSWORD`

2. **Other Email Providers**:
   - Update `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USE_TLS`, and `MAIL_USE_SSL` accordingly
   - Common settings:
     - **Outlook**: `smtp-mail.outlook.com`, port `587`, TLS enabled
     - **Yahoo**: `smtp.mail.yahoo.com`, port `587`, TLS enabled

## Configuration

### Required Environment Variables
- `OPENAI_API_KEY` - Your OpenAI API key (must be set)

### Optional Environment Variables

#### OpenAI Settings
- `OPENAI_MODEL` - Model to use (default: `gpt-4o-mini`)
- `OPENAI_TEMPERATURE` - Response creativity 0.0-2.0 (default: `0.7`)
- `OPENAI_MAX_TOKENS` - Max response length (default: `300`)
- `OPENAI_FREQUENCY_PENALTY` - Reduce repetition (default: `0`)
- `OPENAI_PRESENCE_PENALTY` - Encourage new topics (default: `0`)

#### Flask Settings
- `FLASK_RUN_HOST` - Host to bind to (default: `0.0.0.0`)
- `FLASK_RUN_PORT` - Port number (default: `5001`)
- `FLASK_DEBUG` - Debug mode (default: `True`)
- `FLASK_SECRET_KEY` - Secret key for sessions (auto-generated if not set)

#### Session Settings
- `SESSION_PERMANENT` - Make sessions permanent (default: `False`)
- `SESSION_LIFETIME_HOURS` - Session expiration in hours (default: `24`)
- `SESSION_COOKIE_SECURE` - Require HTTPS for cookies (default: `False`)
- `SESSION_COOKIE_HTTPONLY` - Prevent JavaScript access (default: `True`)
- `SESSION_COOKIE_SAMESITE` - Cookie SameSite policy (default: `Lax`)

#### Email Settings
- `MAIL_SERVER` - SMTP server (default: `smtp.gmail.com`)
- `MAIL_PORT` - SMTP port (default: `587`)
- `MAIL_USE_TLS` - Use TLS encryption (default: `True`)
- `MAIL_USE_SSL` - Use SSL encryption (default: `False`)
- `MAIL_USERNAME` - SMTP username
- `MAIL_PASSWORD` - SMTP password (use App Password for Gmail)
- `MAIL_FROM_EMAIL` - Sender email address
- `MAIL_FROM_NAME` - Sender display name (default: `Strength Club`)
- `MAIL_SUBJECT_LOW` - Email subject for low-priority escalations
- `MAIL_SUBJECT_HIGH` - Email subject for high-priority escalations

#### System Prompt Settings
- `SYSTEM_PROMPT_DIR` - Directory containing modular prompt files (default: `prompts`)

## Project Structure

```text
chatbot/
├── app.py                      # Main Flask application and API routes
├── config.py                   # Configuration and environment variable loading
├── requirements.txt            # Python dependencies
├── README.md                   # This file
│
├── prompts/                    # Modular system prompt files (recommended)
│   ├── 01_foundation.txt       # Role, personality, core responsibilities
│   ├── 02_discovery_recommendation.txt  # Discovery flows and recommendation logic
│   └── 03_constraints_escalation_reference.txt  # Constraints, escalation, reference info
│
├── docs/                       # Documentation
│   ├── CHATBOT_IMPLEMENTATION.md
│   ├── CONFIG_IMPLEMENATION.md
│   ├── ESCALATION_IMPLEMENTATION.md
│   ├── SESSION_MANAGEMENT_IMPLEMENTATION.md
│   ├── STORAGE_LAYER_IMPLEMENTATION.md
│   └── initial_system_prompt.md
│
├── data/                       # JSON storage directory
│   ├── conversations/          # Saved conversation files
│   ├── escalations/            # Escalation records
│   └── users/                  # User data (future use)
│
├── static/                     # Static assets
│   ├── css/
│   │   └── chat.css           # Chat interface styles
│   └── js/
│       ├── chat.js            # Main chat functionality
│       └── discovery-patterns.js  # Discovery flow patterns
│
├── templates/
│   └── chat.html              # Main chat interface template
│
└── utils/                      # Utility modules
    ├── __init__.py
    ├── chatbot.py             # ChatBot class with OpenAI integration
    ├── session_manager.py     # Session lifecycle management
    ├── storage.py             # JSON file storage operations
    ├── escalation_utils.py    # Escalation detection and extraction
    ├── email_notifications.py # Email sending utilities
    └── validation.py          # Input validation utilities
```

**Note:** The system prompt is organized as multiple files in `prompts/` directory. The code automatically loads numbered files in order (01, 02, 03) and combines them into a single prompt.

## Usage

### For End Users

1. **Start a Conversation**
   - Open the chat interface
   - Type a message or click a suggestion button
   - The bot will guide you through discovery questions

2. **Discovery Flow**
   - Answer questions about your goals (Strength/Powerlifting, Competition Prep, Nutrition)
   - The bot will recommend coaching options
   - Provide your name, mobile number, and email address when asked

3. **Escalation**
   - **Automatic**: After completing discovery, the bot will collect your details (name, mobile, email) and escalate automatically
   - **Manual**: Type phrases like "speak to human", "talk to a person", or "I need help" to request immediate assistance
   - Fill in the escalation form with your contact information
   - You will receive a confirmation email when your escalation is created

4. **Conversation History**
   - View past conversations from the sidebar
   - Click on a conversation to reload it
   - Delete conversations you no longer need

### For Developers

#### API Endpoints

**`GET /`**
- Renders the main chat interface

**`POST /api/start_session`**
- Initialize a new chat session
- Body: `{"load_existing": false, "conversation_id": "uuid"}` (optional)
- Returns: `{"success": true, "conversation_id": "uuid", "welcome_message": "..."}`

**`POST /api/chat`**
- Send a message to the chatbot
- Body: `{"message": "user message", "session_id": "uuid"}` (optional)
- Returns: `{"response": "bot reply", "escalation_needed": false, "session_id": "uuid"}`

**`POST /api/escalate`**
- Create a high-priority escalation
- Body: `{"conversation_id": "uuid", "reason": "...", "contact_info": {...}}`
- Returns: `{"success": true, "message": "..."}`

**`GET /api/get_history`**
- Get conversation history for current session
- Returns: `{"success": true, "messages": [...], "escalated": false}`

**`GET /api/past-chats`**
- List all past conversations
- Returns: `{"success": true, "conversations": [...]}`

**`POST /api/new-chat`**
- Start a fresh conversation
- Returns: `{"success": true, "conversation_id": "uuid", "message": "..."}`

**`POST /api/delete_conversation`**
- Delete a conversation
- Body: `{"conversation_id": "uuid"}`
- Returns: `{"success": true, "message": "..."}`

**`GET /api/session_info`**
- Get current session information
- Returns: `{"success": true, "session": {...}}`

**`POST /api/end_session`**
- End current session
- Returns: `{"success": true, "message": "..."}`

**`GET /health`**
- Health check endpoint
- Returns: `{"status": "healthy"}`

#### Data Storage

**Conversations** (`data/conversations/{conversation_id}.json`):
```json
{
  "id": "uuid",
  "created_at": "2025-01-01T12:00:00",
  "updated_at": "2025-01-01T12:05:00",
  "title": "New Chat",
  "messages": [...],
  "escalated": false
}
```

**Escalations** (`data/escalations/{conversation_id}_escalation.json`):
```json
{
  "conversation_id": "uuid",
  "timestamp": "2025-01-01T12:05:00",
  "reason": "Customer requested immediate human assistance",
  "contact_info": {
    "name": "John Doe",
    "mobile": "0123456789",
    "email": "john@example.com",
    "goal": "Build strength",
    "plan": "Online coaching",
    "issue": "Question about training"
  },
  "priority": "high",
  "status": "pending"
}
```

#### Architecture

1. **Request Flow**:
   - User sends message → Flask route → Session Manager → ChatBot → OpenAI API
   - Response → Escalation Detection → Storage → Frontend

2. **Escalation Flow**:
   - **Low Priority**: Bot detects handover confirmation → Extract info (name, mobile, email) → Save escalation → Send email
   - **High Priority**: User requests help → Show modal → Collect info → Save escalation → Send email

3. **Session Management**:
   - Sessions tracked in Flask session with expiration
   - Conversations linked to sessions via `conversation_id`
   - Automatic cleanup of expired sessions

## Development

### Running in Development Mode

```bash
# Activate virtual environment
source venv/bin/activate

# Set debug mode
export FLASK_DEBUG=True

# Run application
python app.py
```

### Testing Escalation Features

1. **Test Low Priority Escalation**:
   - Start conversation
   - Complete discovery flow
   - Provide name, mobile number, and email address when asked
   - Check `data/escalations/` for new escalation file
   - Verify email was sent (if configured)

2. **Test High Priority Escalation**:
   - Start conversation
   - Type "speak to human" or similar
   - Fill escalation form (including email)
   - Check `data/escalations/` for high-priority escalation
   - Verify email was sent

### Adding New Features

1. **Modify System Prompt**: Edit files in `prompts/` directory
2. **Add API Routes**: Add new routes in `app.py`
3. **Extend Storage**: Add functions in `utils/storage.py`
4. **Update Frontend**: Modify `templates/chat.html` and `static/js/chat.js`

### Logging

The application uses Python's logging module. Configure logging level in your code:
```python
import logging
logging.basicConfig(level=logging.INFO)
```

## Troubleshooting

### Common Issues

- **Missing API key**: Ensure `.env` file contains `OPENAI_API_KEY`
- **Port in use**: Change `FLASK_RUN_PORT` in `.env`
- **System prompt not found**: Verify `prompts/` directory exists with numbered .txt files (01_foundation.txt, 02_discovery_recommendation.txt, 03_constraints_escalation_reference.txt)
- **Email not sending**:
  - Check email configuration in `.env`
  - For Gmail, ensure you're using an App Password, not your regular password
  - Verify SMTP server settings match your email provider
- **Sessions expiring too quickly**: Increase `SESSION_LIFETIME_HOURS` in `.env`
- **Conversations not saving**: Check that `data/conversations/` directory exists and is writable

### Debug Mode

Enable debug mode for detailed error messages:
```env
FLASK_DEBUG=True
```

**Warning**: Never enable debug mode in production!

## Security

### Production Checklist

- [ ] Set `FLASK_DEBUG=False` in production
- [ ] Set a strong `FLASK_SECRET_KEY` (use a secure random string)
- [ ] Set `SESSION_COOKIE_SECURE=True` (requires HTTPS)
- [ ] Use HTTPS for all connections
- [ ] Never commit `.env` files to version control
- [ ] Use environment-specific API keys
- [ ] Implement rate limiting for API endpoints
- [ ] Add authentication/authorization for admin endpoints
- [ ] Regularly update dependencies
- [ ] Use secure email credentials (App Passwords, not regular passwords)

### Environment Variables Security

- Store sensitive values in `.env` file (never commit to git)
- Use `.gitignore` to exclude `.env` files
- Rotate API keys and passwords regularly
- Use different credentials for development and production