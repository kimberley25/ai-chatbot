from openai import OpenAI
from openai import APIError, RateLimitError, APIConnectionError
from typing import List, Dict, Tuple
import logging
import re

from config import (
    OPENAI_API_KEY, 
    OPENAI_MODEL, 
    OPENAI_TEMPERATURE, 
    OPENAI_MAX_TOKENS,
    SYSTEM_PROMPT
)

# Set up logging
logger = logging.getLogger(__name__)


class ChatBot:
    """
    ChatBot class for handling OpenAI API interactions with escalation detection.
    
    Loads company context, builds system prompts, sends conversation history to OpenAI,
    and detects when escalation to human support is needed.
    """
    
    # Escalation detection patterns
    ESCALATION_PATTERNS = [
        r"i cannot help with",
        r"i can't help with",
        r"i'm unable to help",
        r"escalate",
        r"human assistance needed",
        r"speak to a (?:human|person|representative|agent|support)",
        r"transfer to (?:human|person|representative|agent|support)",
        r"connect me with (?:a )?(?:human|person|representative|agent|support)",
        r"talk to (?:a )?(?:human|person|representative|agent|support)",
        r"need (?:a )?(?:human|person|representative|agent|support)",
        r"want (?:to )?speak (?:to|with) (?:a )?(?:human|person|representative|agent|support)",
    ]
    
    def __init__(self, system_prompt: str = None):
        """
        Initialize the ChatBot with OpenAI client and configuration.
        
        Args:
            system_prompt: Company context and rules. If None, uses SYSTEM_PROMPT from config.
        
        Raises:
            ValueError: If OPENAI_API_KEY is not set.
        """
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set in environment variables")
        
        # Initialize OpenAI client
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        
        # Store configuration
        self.model = OPENAI_MODEL
        self.temperature = OPENAI_TEMPERATURE
        self.max_tokens = OPENAI_MAX_TOKENS
        
        # Load company context/system prompt
        self.system_prompt = system_prompt or SYSTEM_PROMPT
        
        logger.info(f"ChatBot initialized with model: {self.model}")
    
    def _detect_escalation(self, text: str) -> bool:
        """
        Detect if text contains escalation indicators.
        
        Args:
            text: Text to check for escalation patterns.
        
        Returns:
            bool: True if escalation is detected, False otherwise.
        """
        if not text:
            return False
        
        text_lower = text.lower()
        
        # Check against escalation patterns
        for pattern in self.ESCALATION_PATTERNS:
            if re.search(pattern, text_lower, re.IGNORECASE):
                logger.info(f"Escalation detected in text: {pattern}")
                return True
        
        return False
    
    def _build_messages(self, conversation_history: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Build messages list with system prompt if not already present.
        
        Args:
            conversation_history: List of message dictionaries.
        
        Returns:
            List of messages with system prompt included.
        """
        messages = conversation_history.copy()
        
        # Check if system prompt is already in messages
        has_system = any(msg.get('role') == 'system' for msg in messages)
        
        if not has_system:
            # Prepend system prompt
            messages.insert(0, {
                'role': 'system',
                'content': self.system_prompt
            })
        
        return messages
    
    def get_response(
        self, 
        messages: List[Dict[str, str]], 
        user_message: str = None
    ) -> Tuple[str, bool]:
        """
        Get AI response from OpenAI API and detect escalation needs.
        
        Args:
            messages: List of message dictionaries with 'role' and 'content' keys.
            user_message: Optional user message to check for escalation requests.
        
        Returns:
            Tuple[str, bool]: (AI response content, escalation_flag)
                - escalation_flag is True if escalation is needed, False otherwise.
        
        Raises:
            ValueError: If messages list is empty or invalid.
            APIError: If OpenAI API returns an error.
        """
        if not messages:
            raise ValueError("Messages list cannot be empty")
        
        if not isinstance(messages, list):
            raise ValueError("Messages must be a list")
        
        # Check user message for explicit escalation request
        user_escalation = False
        if user_message:
            user_escalation = self._detect_escalation(user_message)
            if user_escalation:
                logger.info("User explicitly requested escalation")
        
        # Build messages with system prompt
        full_messages = self._build_messages(messages)
        
        try:
            # Get AI response
            response = self.client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            
            # Extract response content
            bot_response = response.choices[0].message.content
            
            if not bot_response:
                logger.warning("Received empty response from OpenAI API")
                raise ValueError("Empty response from OpenAI API")
            
            # Check bot response for escalation indicators
            bot_escalation = self._detect_escalation(bot_response)
            
            # Escalation needed if user requested it OR bot indicates it can't help
            escalation_flag = user_escalation or bot_escalation
            
            if escalation_flag:
                logger.info(f"Escalation flag set: user_escalation={user_escalation}, bot_escalation={bot_escalation}")
            
            return bot_response, escalation_flag
            
        except RateLimitError as e:
            logger.error(f"OpenAI API rate limit exceeded: {e}")
            raise
        except APIConnectionError as e:
            logger.error(f"OpenAI API connection error: {e}")
            raise
        except APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in get_response: {e}")
            raise