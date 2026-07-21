"""
ui/components/sidebar.py
OWNS: Left navigation panel
EXPOSES: render_sidebar()
FORBIDDEN: Pipeline execution
"""
import streamlit as st
from config.settings import Settings
from ui.state import clear_conversation, reboot_engine

def render_sidebar():
    # Sidebar container via st.markdown for custom styling
    # Use streamlit columns? We'll build with markdown + streamlit widgets where needed.

    # We will render inside the left column (passed from workspace)
    # This function expects to be called within a column context.

    st.markdown("""
    <div class="sage-sidebar-inner">
        <div class="sage-logo">
            <div class="sage-logo-icon">🧠</div>
            <div>
                <div class="sage-logo-text">SAGE</div>
                <div class="sage-logo-sub">Systemic Agentic General Engine</div>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # New Conversation button
    if st.button("✦ New Conversation  +", key="new_conv", use_container_width=True):
        clear_conversation()
        st.rerun()

    # Navigation
    nav_items = [
        ("📊", "Dashboard", False),
        ("💬", "Conversations", True),
        ("🤖", "Agents", False),
        ("🧠", "Memory", False),
        ("🛠️", "Tools", False),
        ("⚙️", "Settings", False),
    ]
    for icon, label, active in nav_items:
        # Using button for interaction but styled via CSS
        btn_label = f"{icon}  {label}"
        # mark active
        if active:
            st.markdown(f'<div class="sage-nav-button active">{btn_label}</div>', unsafe_allow_html=True)
        else:
            if st.button(btn_label, key=f"nav_{label}", use_container_width=True):
                st.toast(f"{label} — Coming in next sprint")

    st.markdown("<div style='height: 20px;'></div>", unsafe_allow_html=True)

    # API Configuration
    st.markdown('<div class="sage-status-header">🔑 API Configuration</div>', unsafe_allow_html=True)
    
    # Show if server key exists
    if Settings.GROQ_API_KEY:
        st.success(f"Using: `{Settings.get_masked_key()}`")
    else:
        st.warning("No server key found.")

    # Custom key input
    api_key_input = st.text_input(
        "Use Your Own Key (Optional)",
        type="password",
        placeholder="gsk_...",
        value=st.session_state.get("api_key", ""),
        key="sidebar_api_input",
        label_visibility="visible"
    )
    if api_key_input and api_key_input.strip().startswith("gsk_"):
        if api_key_input.strip() != st.session_state.get("api_key", ""):
            st.session_state.api_key = api_key_input.strip()
            reboot_engine()
            st.toast("API Key updated, rebooting engine...")

    # Engine status
    st.markdown(f"""
    <div class="sage-system-status">
        <div class="sage-status-header">System Status</div>
        <div class="sage-status-row"><span class="sage-status-label">Engine Status</span><span class="sage-status-value online">● Online</span></div>
        <div class="sage-status-row"><span class="sage-status-label">Active Model</span><span class="sage-status-value">{Settings.DEFAULT_MODEL}</span></div>
        <div class="sage-status-row"><span class="sage-status-label">Version</span><span class="sage-status-value">SAGE v{Settings.APP_VERSION}</span></div>
    </div>
    """, unsafe_allow_html=True)

    # Audio settings toggle
    st.markdown('<div class="sage-status-header" style="margin-top:16px;">🎧 Audio Settings</div>', unsafe_allow_html=True)
    tts_toggle = st.toggle("Enable Voice Responses", value=st.session_state.get("tts_enabled", False), key="tts_toggle")
    st.session_state.tts_enabled = tts_toggle

    # Active capabilities
    st.markdown("""
    <div style="margin-top:16px;" class="sage-status-header">⚡ Active Capabilities</div>
    <div style="font-size:11px; color:#a1a1aa; line-height:1.8;">
        • <span style="color:#e4e4e7;">Text Analysis</span> — Research, Explain, Debug<br/>
        • <span style="color:#e4e4e7;">Web Reading</span> — Paste any URL<br/>
        • <span style="color:#e4e4e7;">Computer Vision</span> — Upload images<br/>
        • <span style="color:#e4e4e7;">Voice Input</span> — Speak your query<br/>
        • <span style="color:#e4e4e7;">Voice Output</span> — Listen to responses<br/>
        • <span style="color:#e4e4e7;">Copy Output</span> — One-click clipboard
    </div>
    """, unsafe_allow_html=True)

    st.markdown("""
    <div class="sage-profile" style="margin-top:24px;">
        <div class="sage-avatar">g</div>
        <div class="sage-profile-info">
            <div class="sage-profile-name">gamp</div>
            <div class="sage-profile-role">Beginner Builder</div>
        </div>
        <div class="sage-pro-badge">PRO</div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
    if st.button("🔄 Reboot Engine", key="reboot", use_container_width=True):
        reboot_engine()
        st.toast("Engine rebooted")
        st.rerun()
