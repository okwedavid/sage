"""
ui/components/sidebar.py — V2 PREMIUM SVG ICONS
OWNS: Left navigation panel
EXPOSES: render_sidebar()
FORBIDDEN: Pipeline execution
"""
import streamlit as st
from config.settings import Settings
from ui.state import clear_conversation, reboot_engine

# Premium SVG icon set (Lucide style) - no emojis
ICONS = {
    "dashboard": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>',
    "conversations": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 11.5a8.5 8.5 0 0 1-2.5 6.08A9 9 0 0 1 12 20a8.5 8.5 0 0 1-4.7-1.4L3 21l2.4-4.3A8.5 8.5 0 0 1 3.5 11.5a8.5 8.5 0 0 1 8.5-8.5a8.5 8.5 0 0 1 8.5 8.5"/><path d="M8 11h8M8 15h5"/></svg>',
    "agents": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="14" rx="3"/><path d="M7 21h10"/><path d="M12 17v4"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>',
    "memory": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2a3 3 0 0 0-3 3v1H6a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3h-3V5a3 3 0 0 0-3-3Z"/><path d="M9 12h6"/><path d="M9 16h6"/><path d="M9 8h1"/></svg>',
    "tools": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-3.8 3.8Z"/><path d="M5 19l2-2M2 20a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/><path d="M12 13l1.5 1.5"/><path d="M18 8l-4 4"/></svg>',
    "settings": '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 9 15a1.65 1.65 0 0 0-1-1.51V13a2 2 0 0 1 4 0v.49c.37.17.7.44.93.78"/></svg>',
    "search": '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><path d="m21 21-3.5-3.5"/></svg>',
    "plus": '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
}

def render_sidebar():
    # Logo with Space Grotesk + neural icon
    st.markdown("""
    <div style="padding: 16px 12px 8px 12px; display:flex; align-items:center; gap:12px;">
        <div style="width:38px; height:38px; background: linear-gradient(135deg, #667eea 0%, #764ba2 60%, #f093fb 100%); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 16px rgba(102,126,234,0.3), inset 0 1px 0 rgba(255,255,255,0.2);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M9.5 2a4.5 4.5 0 0 0-4.5 4.5v3A3.5 3.5 0 0 0 8.5 13v3.5A2.5 2.5 0 0 0 11 19v1"/><path d="M14.5 2a4.5 4.5 0 0 1 4.5 4.5v3A3.5 3.5 0 0 1 15.5 13v3.5A2.5 2.5 0 0 1 13 19v1"/><path d="M12 8a2.5 2.5 0 0 0-2.5 2.5V14h5v-3.5A2.5 2.5 0 0 0 12 8Z"/><circle cx="12" cy="14" r="1" fill="white"/><circle cx="9" cy="11" r="0.8" fill="white"/><circle cx="15" cy="11" r="0.8" fill="white"/></svg>
        </div>
        <div>
            <div style="font-family:'Space Grotesk', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em; color:#e4e4e7;">SAGE</div>
            <div style="font-size:9px; color:#71717a; letter-spacing:0.12em; text-transform:uppercase; margin-top:-3px;">Systemic Agentic</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # New Conversation - premium gradient
    if st.button("New Conversation  +", key="new_conv", use_container_width=True, type="primary"):
        clear_conversation()
        st.rerun()

    st.markdown("<div style='height:10px;'></div>", unsafe_allow_html=True)

    # Navigation with SVG icons - no emojis
    nav_items = [
        (ICONS["dashboard"], "Dashboard", False),
        (ICONS["conversations"], "Conversations", True),
        (ICONS["agents"], "Agents", False),
        (ICONS["memory"], "Memory", False),
        (ICONS["tools"], "Tools", False),
        (ICONS["settings"], "Settings", False),
    ]
    for icon_svg, label, active in nav_items:
        active_class = " active" if active else ""
        # Build custom HTML for nav (click handled via toast for non-active)
        if active:
            st.markdown(f'<div class="sage-nav-item{active_class}">{icon_svg}<span>{label}</span><span style="margin-left:auto; width:6px; height:6px; background:#667eea; border-radius:50%; box-shadow:0 0 8px #667eea;"></span></div>', unsafe_allow_html=True)
        else:
            if st.button(f"{label}", key=f"nav_{label}", use_container_width=True):
                st.toast(f"{label} — Coming Sprint 7-10")

    st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)

    # API Config - compact premium
    st.markdown('<div style="font-size:10px; font-weight:700; letter-spacing:0.1em; color:#71717a; text-transform:uppercase; padding:0 14px; margin-bottom:8px;">System</div>', unsafe_allow_html=True)
    
    # Status card
    from config.settings import Settings
    masked = Settings.get_masked_key() if Settings.GROQ_API_KEY else "No server key"
    st.markdown(f"""
    <div class="sage-system-status" style="margin:0 12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-size:10px; font-weight:700; letter-spacing:0.08em; color:#71717a; text-transform:uppercase;">Engine Status</span>
            <span style="display:flex; align-items:center; gap:6px; font-size:11px; color:#3fb950; font-weight:600;"><span style="width:7px; height:7px; background:#3fb950; border-radius:50%; box-shadow:0 0 8px #3fb950; display:inline-block; animation: pulse 2s infinite;"></span>Online</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:6px;"><span style="color:#a1a1aa;">Model</span><span style="color:#e4e4e7; font-family:'JetBrains Mono'; font-size:10px;">{Settings.DEFAULT_MODEL[:28]}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:11px;"><span style="color:#a1a1aa;">Version</span><span style="color:#e4e4e7; font-family:'JetBrains Mono';">SAGE v{Settings.APP_VERSION}</span></div>
    </div>
    """, unsafe_allow_html=True)

    # API input - hidden behind expander for clean UX
    with st.expander("API Key", expanded=False):
        api_in = st.text_input("Groq Key", type="password", placeholder="gsk_...", value=st.session_state.get("api_key",""), label_visibility="collapsed")
        if api_in and api_in.strip().startswith("gsk_") and api_in.strip() != st.session_state.get("api_key",""):
            st.session_state.api_key = api_in.strip()
            reboot_engine()
            st.toast("Key updated")

        st.caption(f"Server: {masked}")
        tts_toggle = st.toggle("Voice Responses", value=st.session_state.get("tts_enabled", False), key="tts_toggle2")
        st.session_state.tts_enabled = tts_toggle

    # Profile - premium
    st.markdown("""
    <div style="margin: 18px 12px 0 12px; padding:12px; background: linear-gradient(135deg, rgba(28,30,46,0.8) 0%, rgba(21,21,31,0.9) 100%); border:1px solid #1e2130; border-radius:12px; display:flex; align-items:center; gap:12px; backdrop-filter:blur(12px);">
        <img src="https://i.pravatar.cc/100?img=12" style="width:32px; height:32px; border-radius:9px; border:1px solid #2a2d45;"/>
        <div style="flex:1; line-height:1.2;">
            <div style="font-size:13px; font-weight:600; color:#e4e4e7;">gamp</div>
            <div style="font-size:10px; color:#71717a;">Beginner Builder → Architect</div>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #f093fb 100%); color:white; font-size:8px; font-weight:800; padding:3px 7px; border-radius:5px; letter-spacing:0.08em;">PRO</div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)
    if st.button("Reboot Engine", key="reboot", use_container_width=True):
        reboot_engine()
        st.toast("Engine rebooted")
        st.rerun()
