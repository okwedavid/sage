"""
ui/components/chat_panel.py
OWNS: Chat history rendering loop
EXPOSES: render_chat_panel()
FORBIDDEN: Pipeline execution
"""
import streamlit as st
from ui.components.intent_card import render_intent_card
from ui.components.response_card import render_response_card
from ui.components.pipeline_viz import render_pipeline_viz

def render_chat_panel():
    messages = st.session_state.get("messages", [])

    if not messages:
        # Welcome state matching target image
        st.markdown("""
        <div class="sage-welcome">
            <div class="sage-welcome-h">👋 Welcome back, gamp</div>
            <div class="sage-welcome-sub">How can I help accelerate your intelligence today?</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; margin: 12px 0 24px 0;">
            <div class="sage-prompt-pill">💡 Research computational thinking and summarize it into study notes.</div>
        </div>
        """, unsafe_allow_html=True)

        # Example conversation from target image (show as demo if no messages)
        st.markdown("""
        <div class="sage-msg-assistant">
            <div class="sage-assistant-avatar">🧠</div>
            <div class="sage-assistant-content" style="background: transparent; border: none;">
                <div style="font-size:11px; color:#71717a; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <span style="color:#a78bfa;">● Thinking...</span>
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        return

    for idx, msg in enumerate(messages):
        role = msg.get("role")
        content = msg.get("content", "")
        intent = msg.get("intent")  # dict
        intent_obj = msg.get("intent_obj")
        agent = msg.get("agent", "SAGE")
        ts = msg.get("timestamp", "")
        attachments = msg.get("attachments", {})

        if role == "user":
            # User bubble + maybe image preview
            st.markdown(f'<div class="sage-msg-user">{content}</div>', unsafe_allow_html=True)
            if attachments.get("image_name"):
                st.markdown(f"""
                <div style="display:flex; justify-content:flex-end; margin-top:-8px; margin-bottom:16px;">
                    <div style="background:#1c1e2e; border:1px solid #2a2d45; border-radius:10px; padding:8px 12px; font-size:11px; color:#a1a1aa; display:flex; gap:8px; align-items:center;">
                        <span>🖼️</span><span>{attachments.get('image_name')}</span>
                        <span style="color:#3fb950;">● Attached</span>
                    </div>
                </div>
                """, unsafe_allow_html=True)
        else:
            # Assistant
            # Check if image attachment existed for this message (for vision demo)
            has_image = "architecture" in content.lower() or "vision analysis" in content.lower() or attachments.get("image_name")

            # Assistant avatar container
            st.markdown(f"""
            <div class="sage-msg-assistant" style="margin-top:20px;">
                <div class="sage-assistant-avatar">🧠</div>
                <div style="flex:1;">
                    <div style="font-size:11px; color:#71717a; margin-bottom:6px;">SAGE • {ts}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)

            # Intent card
            if intent:
                render_intent_card(intent)

            # If message had attachments image URL? Show image if stored?
            # For vision result, we already show response card that contains image analysis

            # Response card
            # Use the dedicated component for premium look
            # We will manually build similar structure but using st.markdown for content

            # Header for response
            st.markdown(f"""
            <div class="sage-response-card">
                <div class="sage-response-header">
                    <span>📄 {agent} Intelligence Report</span>
                    <span>{ts}</span>
                </div>
                <div class="sage-response-body">
            """, unsafe_allow_html=True)

            st.markdown(content)

            st.markdown("</div>", unsafe_allow_html=True)  # close body

            # Action bar
            c1, c2, c3, c4 = st.columns([1,1,1,5])
            with c1:
                if st.button("📋 Copy", key=f"copy_hist_{idx}", help="Copy response"):
                    st.code(content, language="markdown")
            with c2:
                if st.button("🔊", key=f"listen_hist_{idx}", help="Listen"):
                    # Quick TTS attempt
                    from ui.boot import ensure_engine
                    _, _, audio_svc = ensure_engine()
                    if audio_svc:
                        try:
                            ab = audio_svc.synthesize(content)
                            st.audio(ab, format="audio/mp3", autoplay=True)
                        except Exception as e:
                            st.error(f"TTS: {e}")
            with c3:
                st.download_button("💾", data=content, file_name=f"sage_report_{idx}.md", key=f"dl_hist_{idx}", help="Save report")

            st.markdown("</div><div style='height:20px;'></div>", unsafe_allow_html=True)
