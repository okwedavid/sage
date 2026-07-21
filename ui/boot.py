"""
ui/boot.py
OWNS: Engine initialization logic
EXPOSES: boot_engine()
FORBIDDEN: UI rendering
"""
import streamlit as st
from agents.registry import AgentRegistry
from agents.general_worker import GeneralWorker
from agents.web_worker import WebWorker
from agents.vision_worker import VisionWorker
from core.intent.pipeline import IntentPipeline
from services.audio_service import AudioService
from config.settings import Settings

def boot_engine(api_key: str):
    """
    Boots SAGE engine. Returns (registry, pipeline, audio_service)
    Handles session caching manually (not @st.cache_resource)
    """
    # Check if already booted with same key
    current_key = st.session_state.get("api_key", "")
    if st.session_state.get("engine_booted") and st.session_state.get("pipeline") and current_key == api_key:
        return (
            st.session_state.registry,
            st.session_state.pipeline,
            st.session_state.audio_service
        )

    if not api_key or not api_key.strip().startswith("gsk_"):
        raise ValueError("Invalid API Key. Must start with gsk_")

    clean_key = api_key.strip()

    # Build registry
    registry = AgentRegistry()
    registry.register_worker("GeneralWorker", GeneralWorker(api_key=clean_key))
    registry.register_worker("WebWorker", WebWorker(api_key=clean_key))
    registry.register_worker("VisionWorker", VisionWorker(api_key=clean_key))

    # Build pipeline
    pipeline = IntentPipeline(api_key=clean_key, registry=registry)

    # Audio
    try:
        audio_service = AudioService(api_key=clean_key)
    except Exception as e:
        audio_service = None
        print(f"⚠️ AudioService boot failed: {e}")

    # Save to session
    st.session_state.registry = registry
    st.session_state.pipeline = pipeline
    st.session_state.audio_service = audio_service
    st.session_state.api_key = clean_key
    st.session_state.engine_booted = True

    return registry, pipeline, audio_service

def ensure_engine():
    """Ensures engine is booted from settings or session key"""
    key = st.session_state.get("api_key") or Settings.GROQ_API_KEY
    if not key:
        return None, None, None
    try:
        return boot_engine(key)
    except Exception as e:
        st.error(f"Boot failed: {e}")
        return None, None, None
