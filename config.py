import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv('.env')
load_dotenv('.flaskenv')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required but not set")
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
OPENAI_TEMPERATURE = float(os.getenv('OPENAI_TEMPERATURE', '0.7'))
OPENAI_MAX_TOKENS = int(os.getenv('OPENAI_MAX_TOKENS', '300'))
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

# Email configuration
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

SYSTEM_PROMPT_FILE = os.getenv('SYSTEM_PROMPT_FILE', 'system_prompt.txt')
SYSTEM_PROMPT_DIR = os.getenv('SYSTEM_PROMPT_DIR', 'prompts')

def load_system_prompt(file_path=None, prompt_dir=None):
    """
    Load system prompt from file(s).
    
    If prompt_dir is provided and exists, loads all numbered .txt files from that directory
    in order and combines them. Otherwise, loads from a single file.
    
    Args:
        file_path: Path to single prompt file (for backward compatibility)
        prompt_dir: Directory containing multiple prompt files
    
    Returns:
        Combined system prompt string
    """
    # Try loading from directory first (new method)
    if prompt_dir is None:
        prompt_dir = SYSTEM_PROMPT_DIR
    
    prompt_dir_path = Path(prompt_dir)
    if prompt_dir_path.exists() and prompt_dir_path.is_dir():
        # Load all numbered .txt files and combine them
        prompt_files = sorted(prompt_dir_path.glob('[0-9]*_*.txt'))
        
        if prompt_files:
            combined_prompt = []
            for prompt_file in prompt_files:
                try:
                    with open(prompt_file, 'r', encoding='utf-8') as f:
                        content = f.read().strip()
                        if content:
                            combined_prompt.append(content)
                except IOError as e:
                    print(f"Warning: Could not read {prompt_file}: {e}")
            
            if combined_prompt:
                return '\n\n---\n\n'.join(combined_prompt)
    
    # Fallback to single file (backward compatibility)
    if file_path is None:
        file_path = SYSTEM_PROMPT_FILE
    
    prompt_path = Path(file_path)
    if prompt_path.exists():
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    else:
        raise FileNotFoundError(
            f"System prompt not found. Tried directory '{prompt_dir}' and file '{file_path}'. "
            f"Please ensure either the prompts directory exists with numbered .txt files, "
            f"or a single system_prompt.txt file exists."
        )

SYSTEM_PROMPT = load_system_prompt()