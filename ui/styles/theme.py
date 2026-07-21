"""
OWNS: Page-level Streamlit configuration.
EXPOSES: apply_page_config()
FORBIDDEN: Must never render UI elements.
"""

import streamlit as st
from config.settings import Settings


def apply_page_config():
    """Call this ONCE at the very top of app.py, before anything else."""
    st.set_page_config(
        page_title=f"{Settings.APP_NAME} | {Settings.APP_TAGLINE}",
        page_icon="🧠",
        layout="wide",
        initial_sidebar_state="expanded"
    )