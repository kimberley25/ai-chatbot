# Chatbot Implementation Documentation

## Overview

The chatbot system provides AI-powered conversational capabilities using OpenAI's API. It handles user interactions, maintains conversation context, detects escalation needs, and integrates with the application's discovery flow and escalation system.

### Purpose

- **AI-Powered Conversations**: Uses OpenAI GPT models to provide intelligent, context-aware responses
- **Escalation Detection**: Automatically detects when users need human assistance
- **Context Management**: Maintains conversation history for coherent multi-turn dialogues
- **System Prompt Integration**: Loads and applies company-specific instructions and guidelines

### Key Benefits

1. **Intelligent Responses**: Leverages OpenAI's language models for natural, helpful conversations
2. **Escalation Awareness**: Proactively identifies when to escalate to human support
3. **Configurable Behavior**: Adjustable temperature, token limits, and model selection
4. **Error Handling**: Robust error handling for API failures, rate limits, and connection issues

---

## Architecture

### Components

1. **`utils/chatbot.py`**: Core ChatBot class with OpenAI integration and escalation detection
2. **`config.py`**: OpenAI API configuration (API key, model, temperature, max tokens)
3. **`app.py`**: Flask routes that use ChatBot for handling chat requests
4. **`prompts/`**: System prompt files that define chatbot behavior and company context

### Class Structure

```python
class ChatBot:
    - ESCALATION_PATTERNS: List of regex patterns for detecting escalation requests
    - __init__(): Initialize OpenAI client and load system prompt
    - detect_escalation(): Check if text contains escalation indicators
    - _build_messages(): Prepare message list with system prompt
    - get_response(): Get AI response and detect escalation needs
```

---

## How It Works

### Initialization

**Flow:**
1. ChatBot instance is created at application startup
2. Validates `OPENAI_API_KEY` is set (raises `ValueError` if missing)
3. Initializes OpenAI client with API key
4. Loads system prompt from `config.SYSTEM_PROMPT`
5. Stores configuration (model, temperature, max_tokens)

**Code:**
```python
chatbot = ChatBot()  # Created in app.py at startup
```

### Message Processing

**Flow:**
1. User sends message via `/api/chat` endpoint
2. Backend validates message and loads conversation history
3. User message is checked for escalation patterns (before AI call)
4. If escalation detected, returns acknowledgment without AI call
5. Otherwise, calls `chatbot.get_response()` with conversation history
6. ChatBot builds message list with system prompt
7. Sends request to OpenAI API with conversation context
8. Receives AI response and checks for escalation indicators
9. Returns response and escalation flag to frontend

**Message Format:**
```python
messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": "User message 1"},
    {"role": "assistant", "content": "Bot response 1"},
    {"role": "user", "content": "User message 2"},
    # ... more messages
]
```

### Escalation Detection

**Two-Level Detection:**

1. **User Message Detection** (Pre-AI):
   - Checks user input against `ESCALATION_PATTERNS` before calling OpenAI
   - If detected, returns acknowledgment without AI processing
   - Prevents unnecessary API calls when user explicitly requests help

2. **Bot Response Detection** (Post-AI):
   - Checks AI response for escalation indicators
   - Detects phrases like "I cannot help with", "I'm unable to help"
   - Returns escalation flag if bot indicates it can't assist

**Escalation Patterns:**
- "speak to human/agent/representative"
- "talk to a person"
- "need human assistance"
- "I cannot help with"
- "escalate"
- And many variations (see `ESCALATION_PATTERNS` in code)

---

## Configuration

### Environment Variables

Configured in `config.py` via environment variables:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=300
OPENAI_FREQUENCY_PENALTY=0
OPENAI_PRESENCE_PENALTY=0
```

**Configuration Variables:**
- `OPENAI_API_KEY`: **Required** - OpenAI API key for authentication
- `OPENAI_MODEL`: Model to use (default: `gpt-4o-mini`)
- `OPENAI_TEMPERATURE`: Response randomness (0.0-2.0, default: 0.7)
- `OPENAI_MAX_TOKENS`: Maximum tokens in response (default: 300)
- `OPENAI_FREQUENCY_PENALTY`: Reduces repetition (-2.0 to 2.0, default: 0)
- `OPENAI_PRESENCE_PENALTY`: Encourages new topics (-2.0 to 2.0, default: 0)

### System Prompt

System prompt defines chatbot behavior and is loaded from:
- **Preferred**: `prompts/` directory with numbered files (e.g., `01_foundation.txt`)
- **Fallback**: `system_prompt.txt` in project root

See [CONFIG_IMPLEMENTATION.md](./CONFIG_IMPLEMENATION.md) for details on system prompt loading.

---

## API Integration

### OpenAI API Call

```python
response = self.client.chat.completions.create(
    model=self.model,                    # e.g., 'gpt-4o-mini'
    messages=full_messages,              # Conversation history with system prompt
    temperature=self.temperature,        # 0.7
    max_tokens=self.max_tokens          # 300
)
```

**Response Structure:**
```python
{
    "choices": [{
        "message": {
            "content": "AI response text here"
        }
    }]
}
```

### API Error Types

**Rate Limit Errors:**
- `RateLimitError`: API rate limit exceeded
- Logged and re-raised for upstream handling
- Frontend receives appropriate error message

**Connection Errors:**
- `APIConnectionError`: Network/connection issues
- Logged with full error details
- Frontend receives connection error message

**API Errors:**
- `APIError`: General API errors
- Logged with error details
- Frontend receives generic error message

**Empty Responses:**
- Validates response content is not empty
- Raises `ValueError` if response is empty
- Prevents displaying blank messages to users

---

## Usage

### Basic Usage

```python
from utils.chatbot import ChatBot

# Initialize chatbot (uses config.SYSTEM_PROMPT)
chatbot = ChatBot()

# Get response with conversation history
messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": "Hello, I need help with training"}
]

response, escalation_flag = chatbot.get_response(messages, user_message="Hello, I need help with training")

print(response)  # AI response text
print(escalation_flag)  # True if escalation needed, False otherwise
```

### Escalation Detection

```python
# Check if text contains escalation indicators
is_escalation = chatbot.detect_escalation("I want to speak to a human")
# Returns: True

# Check user message before AI call
user_escalation = chatbot.detect_escalation(user_message)
if user_escalation:
    # Handle escalation without calling AI
    return "I'd be happy to connect you with our team..."
```

### Custom System Prompt

```python
# Initialize with custom system prompt
custom_prompt = "You are a helpful fitness coach assistant..."
chatbot = ChatBot(system_prompt=custom_prompt)
```

---

## Response Format

### Return Value

`get_response()` returns a tuple:
```python
(response_text: str, escalation_flag: bool)
```

**Example:**
```python
response, needs_escalation = chatbot.get_response(messages, user_message)

if needs_escalation:
    # Handle escalation
    show_escalation_modal()
else:
    # Display normal response
    display_message(response)
```

---

## Integration Points

### Flask Application (`app.py`)

**Initialization:**
```python
chatbot = ChatBot()  # Global instance
```

**Usage in `/api/chat` endpoint:**
1. Validates user message
2. Loads conversation history
3. Checks for escalation in user message
4. Calls `chatbot.get_response()` if no escalation
5. Processes response and escalation flag
6. Saves conversation with new messages

### Conversation Storage

- Messages stored in `chat_sessions` (in-memory)
- Persisted to `data/conversations/` via `save_conversation()`
- System prompt included in conversation history
- Escalation status tracked per conversation

---

## Error Handling

### Validation

**Input Validation:**
- Empty messages list raises `ValueError`
- Non-list messages raises `ValueError`
- Empty API response raises `ValueError`

**API Key Validation:**
- Missing `OPENAI_API_KEY` raises `ValueError` at initialization
- Prevents runtime errors from missing credentials

### Exception Handling

**In `app.py`:**
```python
try:
    bot_reply, escalation_detected = chatbot.get_response(messages, user_message)
except RateLimitError:
    return jsonify({"error": "Rate limit exceeded. Please try again later."}), 429
except APIConnectionError:
    return jsonify({"error": "Connection error. Please check your internet."}), 503
except APIError as e:
    return jsonify({"error": "AI service error. Please try again."}), 500
```

---

## Files

### Core Files

1. **`utils/chatbot.py`**
   - `ChatBot` class implementation
   - Escalation pattern detection
   - OpenAI API integration
   - Message building and processing

2. **`config.py`**
   - OpenAI configuration variables
   - System prompt loading
   - API key validation

3. **`app.py`**
   - Flask routes using ChatBot
   - Conversation management
   - Error handling and responses

### Related Files

- **`prompts/`**: System prompt files defining chatbot behavior
- **`utils/storage.py`**: Conversation persistence
- **`utils/escalation_utils.py`**: Escalation detection utilities

---

## Notes

### Important Considerations

1. **API Key Security**
   - Never hardcode API keys in code
   - Store in `.env` file (not committed to version control)
   - Use different keys for dev/staging/production

2. **Token Limits**
   - `max_tokens` limits response length (default: 300)
   - Adjust based on expected response length
   - Consider conversation history length for context window

3. **Temperature Settings**
   - Lower (0.0-0.5): More deterministic, focused responses
   - Medium (0.5-1.0): Balanced creativity and consistency
   - Higher (1.0-2.0): More creative, varied responses
   - Default: 0.7 (balanced)

4. **System Prompt Loading**
   - Loaded once at application startup
   - Changes require application restart
   - Large prompts increase memory usage

5. **Escalation Detection**
   - Patterns are case-insensitive
   - Checks both user input and AI responses
   - Can be customized by modifying `ESCALATION_PATTERNS`

### Common Issues

**Issue: "OPENAI_API_KEY is not set"**

- **Solution**: Ensure `.env` file contains `OPENAI_API_KEY=...`
- **Check**: Verify file is in project root

**Issue: Rate limit errors**

- **Solution**: Implement exponential backoff or request queuing
- **Check**: Monitor API usage and upgrade plan if needed

**Issue: Empty responses**

- **Solution**: Check `max_tokens` is sufficient
- **Check**: Verify system prompt is not causing issues
- **Check**: Review API response in logs

**Issue: Escalation not detected**

- **Solution**: Review `ESCALATION_PATTERNS` for missing patterns
- **Check**: Verify pattern matching is case-insensitive
- **Check**: Test with various phrasings

---

## Future Enhancements

### Potential Improvements

1. **Response Streaming**
   - Stream responses token-by-token for better UX
   - Show typing indicator while streaming

2. **Context Window Management**
   - Implement conversation summarization for long chats
   - Truncate old messages while preserving context

3. **Multi-Model Support**
   - Allow switching models per conversation
   - Fallback to cheaper model for simple queries

4. **Response Caching**
   - Cache common responses to reduce API calls
   - Implement cache invalidation strategy

5. **Enhanced Escalation Detection**
   - Use AI to detect escalation intent (not just patterns)
   - Sentiment analysis for frustration detection

6. **Conversation Analytics**
   - Track common questions and responses
   - Identify areas needing better responses

7. **Custom Instructions Per User**
   - Allow users to set preferences
   - Personalize responses based on user history
