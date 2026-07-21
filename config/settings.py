import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """
    OWNS: All configuration values for SAGE.
    EXPOSES: Clean, typed access to settings.
    FORBIDDEN: Must never contain business logic or API calls.
    """
    
    # --- API Configuration ---
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    
    # --- Model Configuration ---
    DEFAULT_MODEL: str = os.getenv("SAGE_DEFAULT_MODEL", "llama-3.3-70b-versatile")
    VISION_MODEL: str = os.getenv("SAGE_VISION_MODEL", "llama-3.2-11b-vision-preview")
    WHISPER_MODEL: str = os.getenv("SAGE_WHISPER_MODEL", "whisper-large-v3")
    
    # --- System Defaults ---
    APP_NAME: str = "SAGE"
    APP_VERSION: str = "5.0"
    APP_TAGLINE: str = "Systemic Agentic General Engine"
    
    # --- Pipeline Defaults ---
    CONFIDENCE_THRESHOLD: float = 0.4
    MAX_TOKENS: int = 1024
    VISION_MAX_TOKENS: int = 1500
    
    # --- Audio Defaults ---
    TTS_LANGUAGE: str = "en"
    TTS_ENABLED: bool = True
    
    # --- Image Defaults ---
    MAX_IMAGE_SIZE_MB: int = 4  # Groq limit
    
    @classmethod
    def validate(cls) -> bool:
        if not cls.GROQ_API_KEY:
            return False
        return True

    @classmethod
    def get_masked_key(cls) -> str:
        key = cls.GROQ_API_KEY
        if len(key) > 8:
            return f"{key[:6]}...{key[-4:]}"
        return "NOT SET"