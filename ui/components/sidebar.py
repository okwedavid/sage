"""
OWNS: The left sidebar — navigation, config, status, profile.
EXPOSES: render_sidebar()
FORBIDDEN: Must never process intents or call AI models.
"""

import streamlit as st
from config.settings import Settings
from ui.state import (
    is_online, get_uptime, get_masked_key, 
    get_session_stats, clear_history, full_reboot
)
from ui.boot import attempt_boot
from ui.styles.palette import Palette as P


def render_sidebar():
    """Renders the complete left sidebar."""
    
    with st.sidebar:
        _render_logo()
        st.divider()
        _render_api_config()
        st.divider()
        _render_system_status()
        st.divider()
        _render_settings()
        st.divider()
        _render_session_controls()
        
        if st.session_state.history:
            st.divider()
            _render_stats()
        
        st.divider()
        _render_user_profile()


def _render_logo():
    """SAGE branding block."""
    st.markdown(f"""
    <div style="text-align:center; padding: 0.3rem 0;">
        <img src="https://em-content.zobj.net/source/apple/391/brain_1f9e0.png" width="55">
        <h2 style="margin:0; font-weight:800; color:{P.TEXT_PRIMARY};">SAGE</h2>
        <p style="color:{P.TEXT_SECONDARY}; font-size:0.7rem; margin:0;">
            v{Settings.APP_VERSION} • {Settings.APP_TAGLINE}
        </p>
    </div>
    """, unsafe_allow_html=True)


def _render_api_config():
    """API key input and boot logic."""
    st.markdown(
        '<div class="nav-title">🔑 API CONFIGURATION</div>', 
        unsafe_allow_html=True
    )
    
    # Check server-side key first
    env_key = Settings.GROQ_API_KEY
    active_key = env_key.strip() if env_key else None
    
    # Manual override input
    manual_key = st.text_input(
        "API Key",
        type="password",
        placeholder="gsk_... (paste your key)",
        label_visibility="collapsed"
    )
    
    if manual_key:
        cleaned = manual_key.strip()
        if cleaned.startswith("gsk_") and len(cleaned) > 20:
            active_key = cleaned
        else:
            st.error("Invalid format. Must start with 'gsk_'")
            active_key = None
    
    # Boot engine if key changed
    if active_key and active_key != st.session_state.active_key:
        with st.spinner("Booting SAGE..."):
            if attempt_boot(active_key):
                st.success("🟢 Online")


def _render_system_status():
    """System health dashboard."""
    st.markdown(
        '<div class="nav-title">🖥️ SYSTEM STATUS</div>', 
        unsafe_allow_html=True
    )
    
    online = is_online()
    status_class = "status-online" if online else "status-offline"
    status_text = "Online" if online else "Offline"
    
    st.markdown(f"""
    <div class="nav-section">
        <div class="status-grid">
            <span class="status-label">Engine</span>
            <span class="status-value {status_class}">{status_text}</span>
            <span class="status-label">Model</span>
            <span class="status-value" style="font-size:0.6rem;">
                {Settings.DEFAULT_MODEL}
            </span>
            <span class="status-label">Uptime</span>
            <span class="status-value">{get_uptime()}</span>
            <span class="status-label">API Key</span>
            <span class="status-value" style="font-size:0.58rem;">
                {get_masked_key()}
            </span>
        </div>
    </div>
    """, unsafe_allow_html=True)


def _render_settings():
    """User-configurable settings."""
    st.markdown(
        '<div class="nav-title">⚙️ SETTINGS</div>', 
        unsafe_allow_html=True
    )
    st.session_state.tts_enabled = st.toggle(
        "🔊 Voice Responses", 
        value=st.session_state.tts_enabled
    )


def _render_session_controls():
    """Clear and Reboot buttons."""
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🗑️ Clear", use_container_width=True):
            clear_history()
            st.rerun()
    with col2:
        if st.button("🔄 Reboot", use_container_width=True):
            full_reboot()
            st.rerun()


def _render_stats():
    """Session statistics."""
    st.markdown(
        '<div class="nav-title">📊 SESSION STATS</div>', 
        unsafe_allow_html=True
    )
    stats = get_session_stats()
    
    st.markdown(f"""
    <div class="nav-section">
        <div class="status-grid">
            <span class="status-label">Queries</span>
            <span class="status-value">{stats["total"]}</span>
            <span class="status-label">Successful</span>
            <span class="status-value">{stats["successful"]}</span>
            <span class="status-label">Success Rate</span>
            <span class="status-value status-online">{stats["rate"]}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)


def _render_user_profile():
    """User identity badge."""
    st.markdown(f"""
    <div class="user-profile">
        <div class="user-avatar">G</div>
        <div>
            <div class="user-name">gamp</div>
            <div class="user-role">Beginner Builder</div>
        </div>
        <span class="pro-badge">PRO</span>
    </div>
    """, unsafe_allow_html=True)