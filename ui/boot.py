"""
OWNS: SAGE engine initialization sequence.
EXPOSES: boot_engine()
FORBIDDEN: Must never render UI elements.
"""

import time
import streamlit as st
from config.settings import Settings
from core.intent.pipeline import IntentPipeline
from agents.registry import AgentRegistry
from agents.general_worker import GeneralWorker
from agents.web_worker import WebWorker
from agents.vision_worker import VisionWorker
from services.audio_service import AudioService


def boot_engine(api_key: str) -> tuple:
    """
    Initializes all SAGE subsystems.
    
    Returns:
        (IntentPipeline, AudioService)
    
    Raises:
        RuntimeError if boot fails.
    """
    
    try:
        # 1. Build the Agent Registry
        registry = AgentRegistry()
        
        # 2. Register all available workers
        registry.register_worker("GeneralWorker", GeneralWorker(api_key=api_key))
        registry.register_worker("WebWorker", WebWorker(api_key=api_key))
        registry.register_worker("VisionWorker", VisionWorker(api_key=api_key))
        
        # Future agents:
        # registry.register_worker("ImageWorker", ImageWorker(api_key=...))
        # registry.register_worker("VideoWorker", VideoWorker(api_key=...))
        
        # 3. Assemble the Pipeline
        pipeline = IntentPipeline(api_key=api_key, registry=registry)
        
        # 4. Initialize Audio Service
        audio = AudioService(api_key=api_key)
        
        return pipeline, audio
        
    except Exception as e:
        raise RuntimeError(f"Engine boot failed: {e}")


def attempt_boot(api_key: str) -> bool:
    """
    Attempts to boot the engine and stores results in session state.
    Returns True on success, False on failure.
    """
    try:
        pipeline, audio = boot_engine(api_key)
        st.session_state.pipeline = pipeline
        st.session_state.audio_service = audio
        st.session_state.active_key = api_key
        st.session_state.boot_time = time.time()
        return True
    except Exception as e:
        st.error(f"❌ Boot failed: {e}")
        return False