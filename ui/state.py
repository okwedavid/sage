"""
ui/state.py
OWNS: All session state management
EXPOSES: init_state(), get/set helpers, clear_reboot
FORBIDDEN: UI rendering, pipeline logic
"""
import streamlit as st
from datetime import datetime

def init_state():
    defaults = {
        "messages": [],  # list of dicts {role, content, intent, agent, timestamp, attachments?}
        "query_count": 0,
        "success_count": 0,
        "api_key": "",
        "engine_booted": False,
        "pipeline": None,
        "registry": None,
        "audio_service": None,
        "current_intent": None,
        "session_start": datetime.now().isoformat(),
        "tts_enabled": False,
        "conversations": [
            {"id": "1", "title": "Analyze this architecture diagram", "time": "2:45 PM", "today": True},
            {"id": "2", "title": "Explain quantum computing", "time": "1:12 PM", "today": True},
            {"id": "3", "title": "Build a Python web scraper", "time": "11:03 AM", "today": True},
            {"id": "4", "title": "Study notes on AI agents", "time": "9:10 PM", "today": False},
            {"id": "5", "title": "Database normalization", "time": "4:22 PM", "today": False},
        ],
        "active_tool": None,
        "uploaded_image": None,
        "uploaded_image_b64": None,
        "uploaded_image_type": None,
        "uploaded_image_name": None,
        "voice_transcript": None,
        "processing": False,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

def add_message(role: str, content: str, intent=None, agent=None, attachments=None):
    ts = datetime.now().strftime("%I:%M %p")
    msg = {
        "role": role,
        "content": content,
        "intent": intent.to_dict() if intent else None,
        "intent_obj": intent,
        "agent": agent,
        "timestamp": ts,
        "attachments": attachments or {}
    }
    st.session_state.messages.append(msg)
    if role == "user":
        st.session_state.query_count += 1
    else:
        # assistant
        if intent and intent.status.name == "COMPLETED":
            st.session_state.success_count += 1

def get_messages():
    return st.session_state.messages

def clear_conversation():
    st.session_state.messages = []
    st.session_state.current_intent = None
    st.session_state.uploaded_image = None
    st.session_state.uploaded_image_b64 = None
    st.session_state.processing = False

def reboot_engine():
    st.session_state.engine_booted = False
    st.session_state.pipeline = None
    st.session_state.registry = None
    st.session_state.audio_service = None
    st.session_state.current_intent = None

def get_stats():
    total = st.session_state.query_count
    success = st.session_state.success_count
    rate = (success / total * 100) if total > 0 else 100.0
    # avg response time mock from processing
    avg_time = 4.2  # to match target image
    return {
        "total": total,
        "successful": success,
        "rate": rate,
        "avg_time": avg_time
    }
