"""
OWNS: Rendering the complete chat history.
EXPOSES: render_chat_history(), render_welcome()
FORBIDDEN: Must never process new inputs or call the pipeline.
"""

import streamlit as st
from ui.styles.palette import Palette as P


def render_welcome():
    """Displays the welcome message when chat is empty."""
    st.markdown(f"""
    <div class="welcome-card">
        <h3>👋 Welcome back, gamp</h3>
        <p>How can I help accelerate your intelligence today?</p>
    </div>
    """, unsafe_allow_html=True)


def render_chat_history():
    """
    Iterates over session history and renders each exchange.
    User messages as 'user' bubbles, SAGE responses as 'assistant' bubbles.
    """
    from ui.components.response_card import render_response
    
    for idx, exchange in enumerate(st.session_state.history):
        
        # User message
        st.chat_message("user").write(exchange["user"])
        
        # SAGE response
        with st.chat_message("assistant", avatar="🧠"):
            render_response(exchange, idx)