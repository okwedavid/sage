"""
app.py — SAGE Web UI Entry Point
OWNS: Pure orchestration (~60 lines)
EXPOSES: Streamlit app
FORBIDDEN: Business logic, styling beyond orchestration
"""
import streamlit as st
from ui.styles.theme import apply_theme
from ui.styles.css import inject_css
from ui.state import init_state
from ui.layouts.workspace import render_workspace
from ui.boot import ensure_engine
from config.settings import Settings

# 1. Theme & Page Config
apply_theme()

# 2. Premium CSS Injection
inject_css()

# 3. Session State Init
init_state()

# 4. Engine Boot (auto from .env if available)
if Settings.GROQ_API_KEY or st.session_state.get("api_key"):
    try:
        ensure_engine()
    except Exception as e:
        st.sidebar.error(f"Boot warning: {e}")

# 5. Main Workspace Layout (3-column Mission Control)
render_workspace()
