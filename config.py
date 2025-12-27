import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# OpenAI Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o')
# OPENAI_TEMPERATURE = os.getenv('OPENAI_TEMPERATURE')
# OPENAI_MAX_TOKENS = os.getenv('OPENAI_MAX_TOKENS')
# OPENAI_FREQUENCY_PENALTY = os.getenv('OPENAI_FREQUENCY_PENALTY')
# OPENAI_PRESENCE_PENALTY = os.getenv('OPENAI_PRESENCE_PENALTY')

# Flask Configuration
FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY') or os.urandom(24)
FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
FLASK_PORT = int(os.getenv('FLASK_PORT', '5001'))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'

# Session Configuration
SESSION_PERMANENT = os.getenv('SESSION_PERMANENT', 'False').lower() == 'true'
SESSION_LIFETIME_HOURS = int(os.getenv('SESSION_LIFETIME_HOURS', '24'))  # Default 24 hours
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() == 'true'  # Set True in production with HTTPS
SESSION_COOKIE_HTTPONLY = os.getenv('SESSION_COOKIE_HTTPONLY', 'True').lower() == 'true'
SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')  # Lax, Strict, or None
SESSION_CLEANUP_INTERVAL_MINUTES = int(os.getenv('SESSION_CLEANUP_INTERVAL_MINUTES', '60'))  # Cleanup every hour

# Company Context Configuration
SYSTEM_PROMPT_FILE = os.getenv('SYSTEM_PROMPT_FILE', 'system_prompt.txt')

def load_system_prompt(file_path=None):
    """Load system prompt from file"""
    if file_path is None:
        file_path = SYSTEM_PROMPT_FILE
    
    prompt_path = Path(file_path)
    if prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    else:
        raise FileNotFoundError(f"System prompt file not found: {file_path}")

# Load the system prompt
SYSTEM_PROMPT = load_system_prompt()