import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('.env')
load_dotenv('.flaskenv')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required but not set")
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o')
OPENAI_TEMPERATURE = float(os.getenv('OPENAI_TEMPERATURE', '0.7'))
OPENAI_MAX_TOKENS = int(os.getenv('OPENAI_MAX_TOKENS', '500'))
OPENAI_FREQUENCY_PENALTY = float(os.getenv('OPENAI_FREQUENCY_PENALTY', '0'))
OPENAI_PRESENCE_PENALTY = float(os.getenv('OPENAI_PRESENCE_PENALTY', '0'))

FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY') or os.urandom(24).hex()
FLASK_HOST = os.getenv('FLASK_RUN_HOST', '0.0.0.0')
FLASK_PORT = int(os.getenv('FLASK_RUN_PORT', '5001'))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'

SESSION_PERMANENT = os.getenv('SESSION_PERMANENT', 'False').lower() == 'true'
SESSION_LIFETIME_HOURS = int(os.getenv('SESSION_LIFETIME_HOURS', '24'))
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
SESSION_COOKIE_HTTPONLY = os.getenv('SESSION_COOKIE_HTTPONLY', 'True').lower() == 'true'
SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
SESSION_CLEANUP_INTERVAL_MINUTES = int(os.getenv('SESSION_CLEANUP_INTERVAL_MINUTES', '60'))

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

SYSTEM_PROMPT = load_system_prompt()