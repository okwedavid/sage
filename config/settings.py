"""
config/settings.py
OWNES: Central config loader (.env -> Python)
EXPOSES: Settings class with all constants
FORBIDDEN: Hardcoding secrets, UI logic
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # API
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    DEFAULT_MODEL: str = os.getenv("SAGE_DEFAULT_MODEL", "llama-3.3-70b-versatile")
    # Updated 2025-04: llama-3.2-11b-vision-preview decommissioned -> use llama-4-scout
    VISION_MODEL: str = os.getenv("SAGE_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
    WHISPER_MODEL: str = os.getenv("SAGE_WHISPER_MODEL", "whisper-large-v3")
    # Fallback vision if scout also deprecated
    VISION_FALLBACK: str = "llama-3.2-90b-vision-preview"
    
    # App Meta
    APP_NAME: str = "SAGE"
    APP_VERSION: str = "6.0"
    APP_TAGLINE: str = "Systemic Agentic General Engine"
    
    # Pipeline
    CONFIDENCE_THRESHOLD: float = 0.4
    MAX_TOKENS: int = 1024
    VISION_MAX_TOKENS: int = 1500
    
    # Audio
    TTS_LANGUAGE: str = "en"
    TTS_ENABLED: bool = True
    MAX_IMAGE_SIZE_MB: int = 4

    @classmethod
    def validate(cls) -> bool:
        if not cls.GROQ_API_KEY:
            return False
        return cls.GROQ_API_KEY.startswith("gsk_")

    @classmethod
    def get_masked_key(cls) -> str:
        key = cls.GROQ_API_KEY or ""
        if len(key) > 8:
            return f"{key[:6]}...{key[-4:]}"
        return "NOT SET"

    @classmethod
    def get_api_key(cls, session_key: str = "") -> str:
        """Priority: session key > env key"""
        if session_key and session_key.strip().startswith("gsk_"):
            return session_key.strip()
        return cls.GROQ_API_KEY
