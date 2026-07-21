"""
SAGE — Systemic Agentic General Engine
=======================================

This is the application entry point.
It orchestrates the UI framework without containing any business logic.

Architecture:
    app.py (this file)
        ├── ui/styles/     → Visual theming
        ├── ui/state.py    → Session management
        ├── ui/boot.py     → Engine initialization
        ├── ui/components/ → Individual UI modules
        └── ui/layouts/    → Page compositions

Run:
    streamlit run app.py
"""

import sys
import os

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ==========================================
# STEP 1: Page Configuration (MUST be first)
# ==========================================
from ui.styles.theme import apply_page_config
apply_page_config()

# ==========================================
# STEP 2: Inject Stylesheet
# ==========================================
from ui.styles.css import inject_css
inject_css()

# ==========================================
# STEP 3: Initialize Session State
# ==========================================
from ui.state import init_state
init_state()

# ==========================================
# STEP 4: Render Sidebar (Navigation + Config)
# ==========================================
from ui.components.sidebar import render_sidebar
render_sidebar()

# ==========================================
# STEP 5: Render Main Workspace
# ==========================================
from ui.layouts.workspace import render_workspace
render_workspace()