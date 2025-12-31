# Configuration Implementation Documentation

## Overview

The `config.py` module serves as the central configuration management system for the Flask chatbot application. It provides a single source of truth for all application settings, including OpenAI API configuration, Flask server settings, session management, email notifications, and system prompt loading.

### Purpose

- **Centralized Configuration**: All application settings are managed in one place
- **Environment-Based**: Uses environment variables with sensible defaults
- **Security**: Keeps sensitive data (API keys, passwords) out of code
- **Flexibility**: Easy to switch between development, staging, and production environments
- **Maintainability**: Clear separation of configuration from application logic

### Key Benefits

1. **Security**: Sensitive credentials stored in `.env` files (not committed to version control)
2. **Flexibility**: Easy to change settings without modifying code
3. **Environment Management**: Different configurations for dev/staging/prod
4. **Type Safety**: Proper type conversion (int, float, bool) for configuration values
5. **Validation**: Required values are validated at startup

---

## Components

### 1. Environment Variable Loading

```python
from dotenv import load_dotenv

load_dotenv('.env')
load_dotenv('.flaskenv')
```

- Loads environment variables from `.env` and `.flaskenv` files
- `.env` typically contains sensitive data (API keys, passwords)
- `.flaskenv` can contain non-sensitive Flask-specific settings
- Uses `python-dotenv` library to parse environment files

### 2. OpenAI Configuration

```python
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
OPENAI_TEMPERATURE = float(os.getenv('OPENAI_TEMPERATURE', '0.7'))
OPENAI_MAX_TOKENS = int(os.getenv('OPENAI_MAX_TOKENS', '300'))
OPENAI_FREQUENCY_PENALTY = float(os.getenv('OPENAI_FREQUENCY_PENALTY', '0'))
OPENAI_PRESENCE_PENALTY = float(os.getenv('OPENAI_PRESENCE_PENALTY', '0'))
```

**Configuration Variables:**
- `OPENAI_API_KEY`: **Required** - OpenAI API key for authentication
- `OPENAI_MODEL`: Model to use (default: `gpt-4o-mini`)
- `OPENAI_TEMPERATURE`: Response randomness (0.0-2.0, default: 0.7)
- `OPENAI_MAX_TOKENS`: Maximum tokens in response (default: 300)
- `OPENAI_FREQUENCY_PENALTY`: Reduces repetition (-2.0 to 2.0, default: 0)
- `OPENAI_PRESENCE_PENALTY`: Encourages new topics (-2.0 to 2.0, default: 0)

**Validation:**
- `OPENAI_API_KEY` raises `ValueError` if not set (prevents runtime errors)

### 3. Flask Server Configuration

```python
FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY') or os.urandom(24).hex()
FLASK_HOST = os.getenv('FLASK_RUN_HOST', '0.0.0.0')
FLASK_PORT = int(os.getenv('FLASK_RUN_PORT', '5001'))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
```

**Configuration Variables:**
- `FLASK_SECRET_KEY`: Secret key for session encryption (auto-generated if not set)
- `FLASK_HOST`: Server host address (default: `0.0.0.0` for all interfaces)
- `FLASK_PORT`: Server port number (default: `5001`)
- `FLASK_DEBUG`: Enable debug mode (default: `True`)

**Notes:**
- Uses Flask's standard environment variable names (`FLASK_RUN_HOST`, `FLASK_RUN_PORT`)
- Secret key auto-generates if not provided (not recommended for production)

### 4. Session Management Configuration

```python
SESSION_PERMANENT = os.getenv('SESSION_PERMANENT', 'False').lower() == 'true'
SESSION_LIFETIME_HOURS = int(os.getenv('SESSION_LIFETIME_HOURS', '24'))
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
SESSION_COOKIE_HTTPONLY = os.getenv('SESSION_COOKIE_HTTPONLY', 'True').lower() == 'true'
SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
SESSION_CLEANUP_INTERVAL_MINUTES = int(os.getenv('SESSION_CLEANUP_INTERVAL_MINUTES', '60'))
```

**Configuration Variables:**
- `SESSION_PERMANENT`: Enable permanent sessions (default: `False`)
- `SESSION_LIFETIME_HOURS`: Session expiration time (default: `24`)
- `SESSION_COOKIE_SECURE`: Only send cookies over HTTPS (default: `False`)
- `SESSION_COOKIE_HTTPONLY`: Prevent JavaScript access (default: `True`)
- `SESSION_COOKIE_SAMESITE`: CSRF protection (`Lax`, `Strict`, `None`, default: `Lax`)
- `SESSION_CLEANUP_INTERVAL_MINUTES`: Cleanup job interval (default: `60`)

**Security Notes:**
- `SESSION_COOKIE_SECURE` should be `True` in production (HTTPS required)
- `SESSION_COOKIE_HTTPONLY` prevents XSS attacks
- `SESSION_COOKIE_SAMESITE` helps prevent CSRF attacks

### 5. Email Configuration

```python
MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
MAIL_PORT = int(os.getenv('MAIL_PORT', '587'))
MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
MAIL_USE_SSL = os.getenv('MAIL_USE_SSL', 'False').lower() == 'true'
MAIL_USERNAME = os.getenv('MAIL_USERNAME', '')
MAIL_PASSWORD = os.getenv('MAIL_PASSWORD', '')
MAIL_FROM_EMAIL = os.getenv('MAIL_FROM_EMAIL', MAIL_USERNAME)
MAIL_FROM_NAME = os.getenv('MAIL_FROM_NAME', 'Strength Club')
MAIL_SUBJECT_LOW = os.getenv('MAIL_SUBJECT_LOW', 'Thank You for Your Interest - Strength Club')
MAIL_SUBJECT_HIGH = os.getenv('MAIL_SUBJECT_HIGH', 'Your Request Has Been Received - Strength Club')
```

**Configuration Variables:**
- `MAIL_SERVER`: SMTP server hostname (default: `smtp.gmail.com`)
- `MAIL_PORT`: SMTP server port (default: `587` for TLS)
- `MAIL_USE_TLS`: Enable TLS encryption (default: `True`)
- `MAIL_USE_SSL`: Enable SSL encryption (default: `False`, use with port 465)
- `MAIL_USERNAME`: SMTP username/email
- `MAIL_PASSWORD`: SMTP password or app password
- `MAIL_FROM_EMAIL`: Sender email address
- `MAIL_FROM_NAME`: Sender display name (default: `Strength Club`)
- `MAIL_SUBJECT_LOW`: Subject for low-priority escalations
- `MAIL_SUBJECT_HIGH`: Subject for high-priority escalations

**Gmail Setup Notes:**
- Use an "App Password" instead of your regular password
- Enable 2-factor authentication first
- Generate app password: Google Account → Security → App passwords

### 6. System Prompt Configuration

```python
SYSTEM_PROMPT_FILE = os.getenv('SYSTEM_PROMPT_FILE', 'system_prompt.txt')
SYSTEM_PROMPT_DIR = os.getenv('SYSTEM_PROMPT_DIR', 'prompts')

def load_system_prompt(file_path=None, prompt_dir=None):
    # ... implementation ...
    
SYSTEM_PROMPT = load_system_prompt()
```

**Configuration Variables:**
- `SYSTEM_PROMPT_FILE`: Single prompt file path (backward compatibility)
- `SYSTEM_PROMPT_DIR`: Directory containing numbered prompt files (preferred)

**Loading Strategy:**
1. **Directory Method (Preferred)**: Loads all numbered `.txt` files from `prompts/` directory
   - Files must be named: `01_filename.txt`, `02_filename.txt`, etc.
   - Files are loaded in numerical order
   - Combined with `---` separators
   - Example: `prompts/01_foundation.txt`, `prompts/02_discovery_recommendation.txt`

2. **Single File Method (Fallback)**: Loads from `system_prompt.txt` if directory doesn't exist

**Error Handling:**
- Raises `FileNotFoundError` if neither method finds prompt files
- Provides helpful error message with both attempted paths

---

## How It Works

### Import Flow

1. **Application Startup**: When `app.py` imports from `config`, Python executes `config.py`
2. **Environment Loading**: `load_dotenv()` reads `.env` and `.flaskenv` files
3. **Variable Assignment**: Configuration variables are set from environment variables or defaults
4. **System Prompt Loading**: `SYSTEM_PROMPT` is loaded from file(s) at module import time
5. **Export**: All configuration variables are available for import

### Usage in Application

```python
# In app.py
from config import (
    FLASK_SECRET_KEY,
    FLASK_HOST,
    FLASK_PORT,
    FLASK_DEBUG,
    SYSTEM_PROMPT,
    # ... other imports
)

# In utils/chatbot.py
from config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    OPENAI_TEMPERATURE,
    OPENAI_MAX_TOKENS,
    SYSTEM_PROMPT
)
```

### System Prompt Loading Process

```
1. Check if prompts/ directory exists
   ├─ YES → Load all numbered .txt files in order
   │         Combine with "---" separators
   │         Return combined prompt
   │
   └─ NO → Check if system_prompt.txt exists
           ├─ YES → Load and return content
           └─ NO → Raise FileNotFoundError
```

**Example Directory Structure:**
```
prompts/
├── 01_foundation.txt              # Company info, role, personality
├── 02_discovery_recommendation.txt # Discovery flow, plan recommendations
└── 03_constraints_escalation_reference.txt # Constraints, escalation rules, services
```

**Combined Output:**
```
[Content from 01_foundation.txt]

---

[Content from 02_discovery_recommendation.txt]

---

[Content from 03_constraints_escalation_reference.txt]
```

### Configuration Precedence

1. **Environment Variables** (highest priority)
   - Set in `.env` or `.flaskenv` files
   - Can be set in system environment
   - Override defaults

2. **Default Values** (lowest priority)
   - Hardcoded in `config.py`
   - Used when environment variable is not set

**Example:**
```python
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
# If OPENAI_MODEL is set in .env → use that value
# If not set → use 'gpt-4o-mini'
```

---

## Setup

### 1. Create Environment Files

Create a `.env` file in the project root:

```bash
# .env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=300

# Flask Configuration
FLASK_SECRET_KEY=your-secret-key-here-minimum-24-characters
FLASK_RUN_HOST=0.0.0.0
FLASK_RUN_PORT=5001
FLASK_DEBUG=True

# Session Configuration
SESSION_PERMANENT=False
SESSION_LIFETIME_HOURS=24
SESSION_COOKIE_SECURE=False
SESSION_COOKIE_HTTPONLY=True
SESSION_COOKIE_SAMESITE=Lax

# Email Configuration (Gmail example)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=Strength Club

# System Prompt Configuration
SYSTEM_PROMPT_FILE=system_prompt.txt
SYSTEM_PROMPT_DIR=prompts
```

### 2. Create `.flaskenv` (Optional)

For Flask-specific settings that don't need to be secret:

```bash
# .flaskenv
FLASK_APP=app.py
FLASK_ENV=development
FLASK_RUN_HOST=0.0.0.0
FLASK_RUN_PORT=5001
```

### 3. Set Up System Prompts

**Option A: Directory Method (Recommended)**

Create a `prompts/` directory with numbered files:

```bash
mkdir prompts
```

Create numbered prompt files:
- `prompts/01_foundation.txt` - Core company info, role, personality
- `prompts/02_discovery_recommendation.txt` - Discovery flow, recommendations
- `prompts/03_constraints_escalation_reference.txt` - Constraints, escalation, services

**Option B: Single File Method**

Create `system_prompt.txt` in the project root with your complete prompt.

### 4. Security Setup

**Add to `.gitignore`:**
```
.env
.flaskenv
*.env
```

**Never commit:**
- `.env` files
- API keys
- Passwords
- Secret keys

### 5. Verify Configuration

Test that configuration loads correctly:

```python
# test_config.py
from config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
    SYSTEM_PROMPT,
    FLASK_SECRET_KEY
)

print(f"Model: {OPENAI_MODEL}")
print(f"API Key set: {bool(OPENAI_API_KEY)}")
print(f"System Prompt length: {len(SYSTEM_PROMPT)} characters")
print(f"Secret Key set: {bool(FLASK_SECRET_KEY)}")
```

Run: `python test_config.py`

---

## Notes

### Important Considerations

1. **API Key Security**
   - Never hardcode API keys in `config.py`
   - Always use environment variables
   - Use different keys for dev/staging/production
   - Rotate keys regularly

2. **Secret Key Generation**
   - In production, use a strong, randomly generated secret key
   - Minimum 24 characters recommended
   - Generate with: `python -c "import secrets; print(secrets.token_hex(24))"`

3. **System Prompt Loading**
   - Prompt is loaded once at application startup
   - Changes to prompt files require application restart
   - Large prompts may increase memory usage
   - Consider caching for frequently accessed prompts

4. **Environment Variables**
   - Boolean values: Use `'True'` or `'False'` (strings)
   - Numeric values: Automatically converted to int/float
   - Case-insensitive for boolean comparisons

5. **Production Settings**
   - Set `FLASK_DEBUG=False`
   - Set `SESSION_COOKIE_SECURE=True` (requires HTTPS)
   - Use strong `FLASK_SECRET_KEY`
   - Use production-grade email service
   - Set appropriate `SESSION_LIFETIME_HOURS`

6. **Error Handling**
   - `OPENAI_API_KEY` validation prevents silent failures
   - System prompt loading provides clear error messages
   - Missing environment variables use defaults (except required ones)

### Common Issues

**Issue: "OPENAI_API_KEY environment variable is required"**
- **Solution**: Ensure `.env` file exists and contains `OPENAI_API_KEY=...`
- **Check**: Verify file is in project root, not in a subdirectory

**Issue: "System prompt not found"**
- **Solution**: Create `prompts/` directory with numbered `.txt` files OR create `system_prompt.txt`
- **Check**: Verify file paths match `SYSTEM_PROMPT_DIR` and `SYSTEM_PROMPT_FILE` settings

**Issue: Configuration changes not taking effect**
- **Solution**: Restart the Flask application
- **Note**: Configuration is loaded at import time, not runtime

**Issue: Email not sending**
- **Solution**: Check `MAIL_USERNAME` and `MAIL_PASSWORD` are correct
- **Gmail**: Use App Password, not regular password
- **Check**: Verify `MAIL_SERVER` and `MAIL_PORT` settings

---

## Future Improvements

### 1. Configuration Schema

Use a configuration schema library (e.g., `pydantic`, `marshmallow`) for:
- Type validation
- Value constraints
- Default value management
- Documentation generation

### 2. Environment-Specific Configs

```python
# config/development.py
# config/production.py
# config/staging.py

ENV = os.getenv('FLASK_ENV', 'development')
if ENV == 'production':
    from config.production import *
elif ENV == 'staging':
    from config.staging import *
else:
    from config.development import *
```

### 3. Hot Reload for System Prompts

```python
import time
from functools import lru_cache

@lru_cache(maxsize=1)
def load_system_prompt_cached(file_path=None, prompt_dir=None, cache_time=300):
    """Load system prompt with caching and auto-reload"""
    # Check file modification time
    # Reload if file changed
    return load_system_prompt(file_path, prompt_dir)
```

### 4. Configuration Documentation Generator

Auto-generate configuration documentation from docstrings and type hints:

```python
def generate_config_docs():
    """Generate markdown documentation from config.py"""
    # Parse config.py
    # Extract variable names, defaults, descriptions
    # Generate markdown table
```

### 5. Secret Management Integration

Integrate with secret management services:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager

### 6. Configuration Testing

```python
# tests/test_config.py
def test_openai_config():
    assert OPENAI_API_KEY is not None
    assert OPENAI_MODEL in ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']
    assert 0.0 <= OPENAI_TEMPERATURE <= 2.0

def test_flask_config():
    assert FLASK_SECRET_KEY is not None
    assert len(FLASK_SECRET_KEY) >= 24
    assert isinstance(FLASK_PORT, int)
    assert 1024 <= FLASK_PORT <= 65535
```

### 7. Configuration Monitoring

Track configuration changes and usage:
- Log configuration values at startup (masking secrets)
- Monitor configuration drift
- Alert on missing required values