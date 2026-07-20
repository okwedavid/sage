import os
from dotenv import load_dotenv

# Load .env file into the operating system's environment
load_dotenv()


class Settings:
    """
    OWNS: All configuration values for SAGE.
    EXPOSES: Clean, typed access to settings.
    FORBIDDEN: Must never contain business logic or API calls.
    """
    
    # --- API Configuration ---
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    DEFAULT_MODEL: str = os.getenv("SAGE_DEFAULT_MODEL", "llama-3.3-70b-versatile")
    
    # --- System Defaults ---
    APP_NAME: str = "SAGE"
    APP_VERSION: str = "3.1"
    APP_TAGLINE: str = "Systemic Agentic General Engine"
    
    # --- Pipeline Defaults ---
    CONFIDENCE_THRESHOLD: float = 0.4
    MAX_TOKENS: int = 1024
    
    @classmethod
    def validate(cls) -> bool:
        """
        Checks if the minimum required config exists.
        Returns True if system can boot, False otherwise.
        """
        if not cls.GROQ_API_KEY:
            return False
        return True
    
    @classmethod
    def get_masked_key(cls) -> str:
        """
        Returns a safe-to-display version of the key.
        Example: 'gsk_abc...xyz'
        """
        key = cls.GROQ_API_KEY
        if len(key) > 8:
            return f"{key[:6]}...{key[-4:]}"
        return "NOT SET"