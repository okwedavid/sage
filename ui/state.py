"""
OWNS: All Streamlit session state initialization and access.
EXPOSES: init_state(), get/set helpers.
FORBIDDEN: Must never render UI or call APIs.
"""

import time
import streamlit as st


def init_state():
    """
    Initializes all session state keys with defaults.
    Safe to call multiple times — only sets if not already present.
    """
    
    defaults = {
        # --- Engine ---
        "pipeline":      None,
        "audio_service": None,
        "active_key":    None,
        "boot_time":     None,
        
        # --- Chat ---
        "history":       [],
        
        # --- Attachments ---
        "pending_image": None,
        
        # --- Settings ---
        "tts_enabled":   True,
        
        # --- UI State ---
        "active_view":   "workspace",   # workspace | dashboard | settings
    }
    
    for key, default in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = default


def is_online() -> bool:
    """Returns True if the SAGE pipeline is initialized."""
    return st.session_state.pipeline is not None


def get_uptime() -> str:
    """Returns formatted uptime string."""
    if not st.session_state.boot_time:
        return "—"
    elapsed = int(time.time() - st.session_state.boot_time)
    hours, remainder = divmod(elapsed, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def get_masked_key() -> str:
    """Returns safe-to-display version of the active API key."""
    key = st.session_state.active_key
    if key and len(key) > 10:
        return f"{key[:6]}...{key[-4:]}"
    return "Not Set"


def get_session_stats() -> dict:
    """Returns computed session statistics."""
    history = st.session_state.history
    total = len(history)
    successful = sum(1 for h in history if h.get("success"))
    rate = (successful / total * 100) if total > 0 else 0
    return {
        "total": total,
        "successful": successful,
        "rate": f"{rate:.1f}%"
    }


def add_to_history(entry: dict):
    """Appends a chat exchange to session history."""
    st.session_state.history.append(entry)


def clear_history():
    """Clears all chat history and cached audio."""
    # Remove any cached TTS audio
    keys_to_remove = [k for k in st.session_state if k.startswith("audio_")]
    for k in keys_to_remove:
        del st.session_state[k]
    st.session_state.history = []
    st.session_state.pending_image = None


def full_reboot():
    """Resets the entire engine state."""
    clear_history()
    st.session_state.pipeline = None
    st.session_state.audio_service = None
    st.session_state.active_key = None
    st.session_state.boot_time = None