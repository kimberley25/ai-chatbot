# Strength Club Chatbot

A Flask-based AI chatbot for Strength Club that helps users discover coaching services through guided conversations and facilitates escalation to human coaches.

## Features

- **AI-Powered Conversations** - OpenAI GPT integration for intelligent responses
- **Discovery Flows** - Guided questions for Strength/Powerlifting, Competition Prep, and Nutrition coaching
- **Session Management** - Persistent sessions with automatic expiration
- **Escalation Handling** - Automatic detection and manual escalation to human coaches
- **Modern UI** - Clean chat interface with discovery chips, typing indicators, and suggestion buttons

## Setup

### Prerequisites
- Python 3.7+
- OpenAI API key

### Installation

1. **Create virtual environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create `.env` file** in project root:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   FLASK_RUN_PORT=5001
   FLASK_DEBUG=True
   ```

4. **Run the application**
   ```bash
   python app.py
   ```

5. **Open in browser**: `http://localhost:5001`

## Configuration

### Required
- `OPENAI_API_KEY` - Your OpenAI API key

### Optional
- `OPENAI_MODEL` - Model to use (default: `gpt-4o-mini`)
- `OPENAI_TEMPERATURE` - Response creativity 0.0-2.0 (default: `0.7`)
- `OPENAI_MAX_TOKENS` - Max response length (default: `300`)
- `FLASK_RUN_PORT` - Port number (default: `5001`)
- `FLASK_DEBUG` - Debug mode (default: `True`)
- `SESSION_LIFETIME_HOURS` - Session expiration (default: `24`)

## Project Structure

```
chatbot/
├── app.py              # Main Flask application
├── config.py           # Configuration
├── system_prompt.txt   # Chatbot instructions (single file, optional)
├── prompts/            # Modular prompt files (recommended)
│   ├── 01_foundation.txt
│   ├── 02_discovery_recommendation.txt
│   └── 03_constraints_escalation_reference.txt
├── requirements.txt    # Dependencies
├── data/              # JSON storage (conversations, escalations, users)
├── static/            # CSS and JavaScript
└── utils/             # Chatbot, session, and storage utilities
```

**Note:** The system prompt can be organized as multiple files in `prompts/` (recommended for easier maintenance) or as a single `system_prompt.txt` file. The code automatically detects and uses the `prompts/` directory if it exists.

## Usage

- Start chatting - the bot will guide you through discovery questions
- Use suggestion buttons for quick-start prompts
- Click "New Chat" to start fresh
- Escalate anytime to connect with a human coach

## Troubleshooting

- **Missing API key**: Ensure `.env` file contains `OPENAI_API_KEY`
- **Port in use**: Change `FLASK_RUN_PORT` in `.env`
- **System prompt not found**: Verify either `prompts/` directory exists with numbered .txt files, or `system_prompt.txt` exists in project root

## Security

- Never commit `.env` files
- Use `SESSION_COOKIE_SECURE=True` in production (requires HTTPS)
- Set a strong `FLASK_SECRET_KEY` for production