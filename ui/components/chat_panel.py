"""
ui/components/chat_panel.py — V2 PREMIUM SVG
OWNS: Chat history rendering loop
EXPOSES: render_chat_panel()
FORBIDDEN: Pipeline execution
"""
import streamlit as st
from ui.components.intent_card import render_intent_card

def render_chat_panel():
    messages = st.session_state.get("messages", [])

    if not messages:
        st.markdown("""
        <div style="padding: 24px 0 12px 0;">
            <div style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; color:#e4e4e7;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Welcome back, gamp
            </div>
            <div style="font-size:13px; color:#a1a1aa; margin-left:24px; margin-top:2px;">How can I help accelerate your intelligence today?</div>
        </div>
        <button style="margin-left:24px; margin-top:8px; padding:10px 16px; border-radius:12px; background:#1c1e2e; border:1px solid #1e2130; color:#a1a1aa; font-size:13px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
            Research computational thinking and summarize it into study notes.
        </button>
        <div style="height:24px;"></div>
        """, unsafe_allow_html=True)
        return

    for idx, msg in enumerate(messages):
        role = msg.get("role")
        content = msg.get("content", "")
        intent = msg.get("intent")
        agent = msg.get("agent", "SAGE")
        ts = msg.get("timestamp", "")
        attachments = msg.get("attachments", {})

        if role == "user":
            st.markdown(f'<div class="sage-msg-user">{content}</div>', unsafe_allow_html=True)
            if attachments.get("image_name"):
                st.markdown(f"""
                <div style="display:flex; justify-content:flex-end; margin-top:-10px; margin-bottom:16px;">
                    <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; background:#1c1e2e; border:1px solid #2a2d45; font-size:11px; color:#a1a1aa;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L3 21"/></svg>
                        {attachments.get('image_name')} <span style="color:#3fb950;">● Attached</span>
                    </div>
                </div>
                """, unsafe_allow_html=True)
        else:
            # Assistant header
            st.markdown(f"""
            <div style="display:flex; gap:12px; margin-top:24px; margin-bottom:8px;">
                <div style="width:32px; height:32px; min-width:32px; background:#1c1e2e; border:1px solid #1e2130; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="1.7"><path d="M9.5 2A4.5 4.5 0 0 0 5 6.5v3A3.5 3.5 0 0 0 8.5 13v3.5A2.5 2.5 0 0 0 11 19v1"/><path d="M14.5 2a4.5 4.5 0 0 1 4.5 4.5v3A3.5 3.5 0 0 1 15.5 13v3.5A2.5 2.5 0 0 1 13 19v1"/><path d="M12 8a2.5 2.5 0 0 0-2.5 2.5V14h5v-3.5A2.5 2.5 0 0 0 12 8Z"/></svg>
                </div>
                <div style="display:flex; align-items:center; gap:8px; font-size:11px; color:#71717a;">
                    <span style="font-weight:600; color:#a1a1aa;">SAGE</span> • {ts} <span style="width:4px; height:4px; background:#3fb950; border-radius:50%; display:inline-block;"></span> {agent}
                </div>
            </div>
            """, unsafe_allow_html=True)

            if intent:
                render_intent_card(intent)

            # Response card
            st.markdown(f"""
            <div class="sage-response-card">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:rgba(15,15,23,0.6); border-bottom:1px solid #1e2130; font-size:11px; font-weight:600; color:#a1a1aa;">
                    <span style="display:flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> {agent} Intelligence Report</span>
                    <span style="color:#71717a;">{ts}</span>
                </div>
                <div class="sage-response-body">
            """, unsafe_allow_html=True)

            st.markdown(content)

            st.markdown("</div>", unsafe_allow_html=True)

            # Action bar with SVG icons
            c1, c2, c3 = st.columns([1,1,5])
            with c1:
                if st.button("Copy", key=f"copy_hist_{idx}", help="Copy"):
                    st.code(content, language="markdown")
            with c2:
                if st.button("Listen", key=f"listen_hist_{idx}", help="Listen"):
                    from ui.boot import ensure_engine
                    _, _, audio_svc = ensure_engine()
                    if audio_svc:
                        try:
                            ab = audio_svc.synthesize(content)
                            st.audio(ab, format="audio/mp3")
                        except Exception as e:
                            st.error(f"TTS: {e}")

            st.markdown("</div><div style='height:20px;'></div>", unsafe_allow_html=True)
