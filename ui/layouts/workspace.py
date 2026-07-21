"""
OWNS: The primary 3-column workspace layout.
EXPOSES: render_workspace()
FORBIDDEN: Must never contain business logic or API calls.

Layout:
┌──────────────────────────────────────────────────────┐
│                    SAGE Header                       │
├──────────────────────────┬───────────────────────────┤
│                          │                           │
│   Cognitive Workspace    │   Intelligence Panel      │
│   (Chat + Responses)     │   (Tools + Inspector)     │
│                          │                           │
├──────────────────────────┴───────────────────────────┤
│   Universal Composer (chat_input)                    │
└──────────────────────────────────────────────────────┘
"""

import streamlit as st
from ui.state import is_online
from ui.components.chat_panel import render_chat_history, render_welcome
from ui.components.inspector import render_inspector
from ui.components.attachment_panel import render_attachments
from ui.components.composer import handle_input


def render_workspace():
    """
    Renders the full workspace layout.
    This is the primary view of SAGE.
    """
    
    _render_header()
    st.divider()
    
    # Gate check
    if not is_online():
        _render_offline_state()
        return
    
    # === THREE-ZONE LAYOUT ===
    chat_col, tools_col = st.columns([3, 1])
    
    # --- RIGHT COLUMN: Intelligence Panel ---
    with tools_col:
        _render_tools_panel()
        st.markdown("---")
        render_attachments()
        st.markdown("---")
        render_inspector()
    
    # --- LEFT COLUMN: Cognitive Workspace ---
    with chat_col:
        if not st.session_state.history:
            render_welcome()
        
        render_chat_history()
        handle_input()


def _render_header():
    """The SAGE hero banner."""
    st.markdown("""
    <div class="sage-hero">
        <h1>SAGE</h1>
        <p class="subtitle">Think. Understand. Act. Evolve.</p>
    </div>
    """, unsafe_allow_html=True)


def _render_offline_state():
    """Shown when engine is not booted."""
    st.info("👈 Enter your Groq API key in the sidebar to start.")
    
    with st.expander("🚀 Quick Start Guide"):
        st.markdown("""
        1. Get a free API key at [console.groq.com](https://console.groq.com)
        2. Paste it in the sidebar
        3. Start asking SAGE anything!
        
        **Examples:**
        - `"Explain how TCP/IP works"` → Text Analysis
        - `"Analyze https://example.com"` → Web Reading
        - 📷 Upload an image → Computer Vision
        - 🎤 Record your voice → Speech Input
        """)


def _render_tools_panel():
    """The tools grid in the right column."""
    st.markdown(
        '<div class="nav-title">🛠️ TOOLS</div>', 
        unsafe_allow_html=True
    )
    
    tools = [
        ("🌐", "Web Search", "Paste a URL to analyze"),
        ("👁️", "Image Analysis", "Upload images for vision"),
        ("🎤", "Voice Input", "Speak your query"),
        ("🔊", "Text to Speech", "Listen to responses"),
    ]
    
    for icon, name, desc in tools:
        st.markdown(f"""
        <div class="tool-item">
            <div class="tool-name">{icon} {name}</div>
            <div class="tool-desc">{desc}</div>
        </div>
        """, unsafe_allow_html=True)