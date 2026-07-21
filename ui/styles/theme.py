"""
ui/styles/theme.py
OWNS: Page configuration
EXPOSES: apply_theme()
FORBIDDEN: CSS rules, component logic
"""
import streamlit as st

def apply_theme():
    st.set_page_config(
        page_title="SAGE — Systemic Agentic General Engine",
        page_icon="🧠",
        layout="wide",
        initial_sidebar_state="collapsed",
        menu_items={
            'Get Help': None,
            'Report a bug': None,
            'About': "SAGE v6.0 — Systemic Agentic General Engine\nThink. Understand. Act. Evolve."
        }
    )
