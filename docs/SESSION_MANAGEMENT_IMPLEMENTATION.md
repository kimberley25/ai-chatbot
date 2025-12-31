# Session Management Implementation Guide

## Overview

The session management system has been implemented to handle user sessions, conversation tracking, and session lifecycle management. It provides automatic session initialization, expiration handling, and secure session storage using Flask's built-in session mechanism with configurable security settings.

The system manages:
1. **Session Lifecycle**: Automatic initialization, validation, expiration, and cleanup
2. **Conversation Association**: Linking conversations to user sessions
3. **Session Persistence**: Maintaining session state across requests
4. **Security**: Configurable cookie security settings (HttpOnly, Secure, SameSite)

## Architecture

### Components

1. **`utils/session_manager.py`**: Core session management utilities (`SessionManager` class)
2. **`app.py`**: Flask application with session middleware (`@app.before_request`)
3. **`config.py`**: Session configuration settings (lifetime, security flags)
4. **Flask Session**: Built-in Flask session storage (cookie-based by default)

## How It Works

### Session Initialization Flow

**Flow:**
1. User makes first request to any endpoint
2. `@app.before_request` middleware runs before every request
3. `session_manager.init_session()` checks if session exists
4. If no session exists, creates new session with:
   - Unique `session_id` (UUID)
   - `created_at` timestamp
   - `last_activity` timestamp
   - `conversation_id` set to `None`
5. If session exists, updates `last_activity` timestamp
6. Session is stored in Flask session cookie (encrypted)

**Detection:**
- Uses `'session_id' not in session` to detect new sessions
- Automatically generates UUID for new sessions

### Session Validation Flow

**Flow:**
1. On each request, `@app.before_request` checks session validity
2. `session_manager.is_session_valid()` checks:
   - If `last_activity` exists in session
   - Calculates expiration time: `last_activity + SESSION_LIFETIME_HOURS`
   - Compares current time with expiration time
3. If session expired:
   - Clears all session data
   - Creates new session
   - Clears conversation association
4. If session valid, continues with request

**Validation Logic:**
- Default lifetime: 24 hours (configurable via `SESSION_LIFETIME_HOURS`)
- Expiration calculated from `last_activity`, not `created_at`
- Activity extends session lifetime

### Conversation Association Flow

**Flow:**
1. User starts new conversation via `/api/start_session`
2. Backend generates new `conversation_id` (UUID)
3. `session_manager.set_conversation(conversation_id)` is called
4. Session's `conversation_id` is set
5. `last_activity` is updated (extends session)
6. Conversation is saved to file storage
7. Subsequent requests use `session_manager.get_conversation_id()` to retrieve conversation

**Loading Existing Conversation:**
1. Frontend sends `load_existing: true` with `conversation_id`
2. Backend validates conversation exists
3. `session_manager.set_conversation(conversation_id)` associates it with session
4. Conversation loaded from file storage into memory cache
5. Messages returned to frontend

### Session Activity Extension

**Flow:**
1. User sends message via `/api/chat`
2. `session_manager.extend_session()` is called
3. Updates `last_activity` timestamp to current time
4. Session expiration time is recalculated from new `last_activity`
5. Effectively extends session lifetime on each activity

**Activity Triggers:**
- Sending chat messages
- Starting new conversations
- Loading existing conversations
- Any API call that uses `session_manager.extend_session()`

## Session Data Structure

Session data is stored in Flask's encrypted session cookie:

```python
{
    'session_id': '60339d9c-47dd-40f0-b70e-02aa807b2759',  # UUID string
    'created_at': '2025-12-27T09:54:21.088052',            # ISO format timestamp
    'last_activity': '2025-12-27T10:30:45.123456',        # ISO format timestamp
    'conversation_id': 'abc-123-def-456'                   # UUID string or None
}
```

**Key Fields:**
- `session_id`: Unique identifier for the session (persists across requests)
- `created_at`: When session was first created (doesn't change)
- `last_activity`: Last time session was active (updated on activity)
- `conversation_id`: Current conversation associated with session (can be None)

## API Endpoints

### `/api/session_info` (GET)
- Returns current session information
- Includes `session_id`, `conversation_id`, `created_at`, `last_activity`
- Useful for debugging and frontend session state management
- **Response:**
  ```json
  {
    "success": true,
    "session": {
      "session_id": "60339d9c-47dd-40f0-b70e-02aa807b2759",
      "conversation_id": "abc-123-def-456",
      "created_at": "2025-12-27T09:54:21.088052",
      "last_activity": "2025-12-27T10:30:45.123456"
    }
  }
  ```

### `/api/start_session` (POST)
- Initializes new conversation or loads existing one
- Associates conversation with current session
- Extends session activity
- **Request Body:**
  ```json
  {
    "load_existing": false,
    "conversation_id": "optional-uuid"
  }
  ```

### `/api/chat` (POST)
- Handles chat messages
- Extends session on each message
- Uses `session_manager.get_conversation_id()` to get current conversation
- **Session Extension:** Automatically calls `session_manager.extend_session()`

### `/api/end_session` (POST)
- Clears all session data
- Ends current session
- Next request will create new session
- **Response:**
  ```json
  {
    "success": true,
    "message": "Session ended"
  }
  ```

### `/api/new-chat` (POST)
- Starts fresh conversation
- Clears current conversation from session
- Creates new conversation_id
- Associates new conversation with session
- Keeps session active (doesn't clear session)

### `/api/delete_conversation` (POST)
- Deletes conversation from storage
- Removes conversation from memory cache
- Clears conversation from session if it was the active one
- Keeps session active (doesn't clear session)

## Session Configuration

Session behavior is configured via environment variables in `.env`:

```env
# Session Lifetime
SESSION_LIFETIME_HOURS=24              # Default: 24 hours

# Session Persistence
SESSION_PERMANENT=False                # Default: False (session expires on browser close)

# Cookie Security Settings
SESSION_COOKIE_SECURE=False            # Default: False (set True in production with HTTPS)
SESSION_COOKIE_HTTPONLY=True           # Default: True (prevents JavaScript access)
SESSION_COOKIE_SAMESITE=Lax            # Default: Lax (CSRF protection)

# Flask Secret Key (required for session encryption)
FLASK_SECRET_KEY=your-secret-key-here # Generate with: python -c "import secrets; print(secrets.token_hex(24))"
```

### Configuration Details

**SESSION_LIFETIME_HOURS:**
- Controls how long a session remains valid after last activity
- Default: 24 hours
- Session expires if no activity for this duration
- Activity resets the expiration timer

**SESSION_PERMANENT:**
- If `True`: Session persists until expiration (even if browser closes)
- If `False`: Session expires when browser closes (but still respects lifetime)
- Default: `False`

**SESSION_COOKIE_SECURE:**
- If `True`: Cookie only sent over HTTPS
- Required for production deployments
- Default: `False` (for development)

**SESSION_COOKIE_HTTPONLY:**
- If `True`: Cookie not accessible via JavaScript (XSS protection)
- Recommended: Always `True`
- Default: `True`

**SESSION_COOKIE_SAMESITE:**
- `Lax`: Cookie sent with top-level navigations (recommended)
- `Strict`: Cookie only sent for same-site requests (more secure, may break some flows)
- `None`: Cookie sent with all requests (requires Secure=True)
- Default: `Lax`

## SessionManager Class Methods

### `init_session()`
- Initializes new session if one doesn't exist
- Updates `last_activity` if session exists
- Called automatically on each request via middleware

### `is_session_valid()`
- Checks if session has expired
- Returns `True` if `last_activity + lifetime > now`
- Returns `False` if expired or invalid

### `extend_session()`
- Updates `last_activity` to current time
- Extends session expiration time
- Called on user activity (messages, API calls)

### `set_conversation(conversation_id)`
- Associates conversation with current session
- Updates `conversation_id` in session
- Automatically extends session

### `get_conversation_id()`
- Returns current `conversation_id` from session
- Returns `None` if no conversation associated

### `clear_conversation()`
- Removes `conversation_id` from session
- Keeps session active (doesn't clear session data)

### `clear_session()`
- Clears all session data
- Completely ends the session
- Next request creates new session

### `get_session_info()`
- Returns dictionary with all session fields
- Useful for debugging and API responses

## Testing

### Test Session Initialization

1. **Using cURL:**
   ```bash
   # First request - should create new session
   curl -X GET http://localhost:5001/api/session_info -c cookies.txt -v
   
   # Check response for session_id, created_at, last_activity
   ```

2. **Expected Behavior:**
   - First request creates new session
   - Response includes `session_id`, `created_at`, `last_activity`
   - Cookie is set with `HttpOnly` and `SameSite=Lax` flags

### Test Session Persistence

1. **Using cURL:**
   ```bash
   # First request
   curl -X GET http://localhost:5001/api/session_info -c cookies.txt
   
   # Second request (should use same session)
   curl -X GET http://localhost:5001/api/session_info -b cookies.txt
   
   # Verify session_id is the same
   ```

2. **Expected Behavior:**
   - Same `session_id` across requests
   - `last_activity` updates on each request
   - `created_at` remains constant

### Test Conversation Association

1. **Using cURL:**
   ```bash
   # Start conversation
   curl -X POST http://localhost:5001/api/start_session \
     -H "Content-Type: application/json" \
     -d '{}' \
     -b cookies.txt -c cookies.txt
   
   # Check session info (should show conversation_id)
   curl -X GET http://localhost:5001/api/session_info -b cookies.txt
   ```

2. **Expected Behavior:**
   - `conversation_id` appears in session after starting conversation
   - `last_activity` is updated
   - Conversation persists across requests

### Test Session Expiration

1. **Temporary Configuration Change:**
   - Modify `utils/session_manager.py` temporarily:
     ```python
     def __init__(self, session_lifetime_hours=24):
         # For testing, use minutes instead
         self.session_lifetime_hours = 0.0167  # 1 minute
     ```

2. **Test Flow:**
   ```bash
   # Create session
   curl -X GET http://localhost:5001/api/session_info -c cookies.txt
   
   # Wait 65 seconds
   sleep 65
   
   # Request again (should create new session)
   curl -X GET http://localhost:5001/api/session_info -b cookies.txt
   ```

3. **Expected Behavior:**
   - After expiration, new session is created
   - Old `session_id` is replaced
   - `conversation_id` is cleared

### Test Session Extension

1. **Using cURL:**
   ```bash
   # Get initial session info
   curl -X GET http://localhost:5001/api/session_info -c cookies.txt > initial.json
   
   # Wait a moment
   sleep 2
   
   # Send message (extends session)
   curl -X POST http://localhost:5001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello"}' \
     -b cookies.txt
   
   # Check session info again
   curl -X GET http://localhost:5001/api/session_info -b cookies.txt > updated.json
   
   # Compare last_activity timestamps
   ```

2. **Expected Behavior:**
   - `last_activity` updates after sending message
   - `session_id` remains the same
   - Session expiration time is extended

### Test End Session

1. **Using cURL:**
   ```bash
   # Get session info
   curl -X GET http://localhost:5001/api/session_info -c cookies.txt
   
   # End session
   curl -X POST http://localhost:5001/api/end_session -b cookies.txt
   
   # Check session info (should create new session)
   curl -X GET http://localhost:5001/api/session_info -b cookies.txt
   ```

2. **Expected Behavior:**
   - After ending session, next request creates new session
   - Old session data is cleared
   - New `session_id` is generated

## Files Modified

1. **New Files:**
   - `utils/session_manager.py` - Session management utilities (`SessionManager` class)

2. **Modified Files:**
   - `app.py` - Added `@app.before_request` middleware for session initialization and validation
   - `config.py` - Added session configuration settings (lifetime, security flags)
   - All API endpoints updated to use `session_manager` instead of direct `session` access

## Installation & Setup

### 1. Configure Session Settings

Add session configuration to your `.env` file:

```env
# Session Configuration
SESSION_LIFETIME_HOURS=24
SESSION_PERMANENT=False
SESSION_COOKIE_SECURE=False          # Set True in production with HTTPS
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE=Lax

# Flask Secret Key (required)
FLASK_SECRET_KEY=your-secret-key-here
```

**Generate Secret Key:**
```bash
python -c "import secrets; print(secrets.token_hex(24))"
```

### 2. Verify Session Manager Import

Ensure `session_manager` is imported in `app.py`:
```python
from utils.session_manager import session_manager
```

### 3. Verify Middleware Setup

Ensure `@app.before_request` middleware is configured in `app.py`:
```python
@app.before_request
def before_request():
    session_manager.init_session()
    if not session_manager.is_session_valid():
        session_manager.clear_session()
        session_manager.init_session()
    # ... rest of middleware
```

### 4. Test Session Functionality

Run the test commands above to verify:
- Session initialization works
- Session persistence works
- Conversation association works
- Session expiration works

## Security Considerations

### Cookie Security
- **HttpOnly**: Prevents JavaScript access to session cookie (XSS protection)
- **Secure**: Ensures cookie only sent over HTTPS (required in production)
- **SameSite**: Prevents CSRF attacks by limiting cookie scope

### Session Expiration
- Sessions expire after inactivity period
- Prevents indefinite session persistence
- Reduces risk of session hijacking

### Secret Key Management
- **Never commit secret keys to version control**
- Use environment variables or secure secret management
- Generate strong random keys (24+ bytes)
- Rotate keys periodically in production

### Session Data
- Session data is encrypted by Flask
- Only contains minimal data (IDs and timestamps)
- No sensitive user data stored in session cookie

## Integration with Other Features

### Conversation Management
- Sessions track which conversation is active
- Multiple conversations can exist, but only one active per session
- Loading existing conversation associates it with current session

### Escalation Feature
- Escalations are linked to conversations, not sessions
- Session can have multiple conversations over time
- Escalation records persist independently of session lifecycle

### Storage Layer
- Conversations stored in `data/conversations/`
- Sessions stored in encrypted cookies (Flask default)
- No session files on disk (stateless)

## Troubleshooting

### Session Not Persisting
- **Check cookie settings**: Ensure `SESSION_COOKIE_SECURE=False` in development
- **Check browser settings**: Ensure cookies are enabled
- **Check domain**: Ensure requests go to same domain
- **Check SameSite**: If using cross-site requests, may need `SameSite=None; Secure=True`

### Session Expiring Too Quickly
- **Check SESSION_LIFETIME_HOURS**: Verify value in `.env`
- **Check activity**: Ensure `extend_session()` is called on activity
- **Check timezone**: Ensure server time is correct

### Session Not Clearing
- **Check clear_session()**: Verify it's being called correctly
- **Check browser**: Clear browser cookies manually if needed
- **Check middleware**: Ensure expiration check runs on each request

### Conversation Not Associating
- **Check set_conversation()**: Verify it's called after conversation creation
- **Check session**: Verify session exists before setting conversation
- **Check conversation_id**: Verify UUID format is correct

## Future Enhancements

Potential improvements:
- Add session activity logging for analytics
- Add session management dashboard (view active sessions)
- Add session timeout warnings to frontend
- Add session-based rate limiting
- Add session storage backend options (Redis, database)
- Add session sharing across multiple servers (for load balancing)
- Add session invalidation API (admin function)
- Add session statistics endpoint (active sessions count)
- Add session cleanup cron job for expired sessions
- Add session migration support (upgrade session format)

