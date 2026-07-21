"""
ui/components/composer.py — V2 PREMIUM EFFICIENT
OWNS: Universal text input handler + pipeline execution
EXPOSES: render_composer()
FORBIDDEN: Sidebar rendering
"""
import streamlit as st
from ui.state import add_message
from ui.boot import ensure_engine

def _prepare_attachments():
    attachments = {}
    if st.session_state.get("uploaded_image_b64"):
        attachments["image_base64"] = st.session_state.uploaded_image_b64
        attachments["image_type"] = st.session_state.get("uploaded_image_type", "jpeg")
        attachments["image_name"] = st.session_state.get("uploaded_image_name", "image")
    return attachments

def render_composer():
    # Premium icon row
    a1, a2, a3, a4, a5 = st.columns([0.8,0.8,0.8,0.8,5])
    with a1:
        if st.button("📎", key="btn_attach", help="Attach image", use_container_width=True):
            st.session_state.show_uploader = not st.session_state.get("show_uploader", False)
    with a2:
        st.button("🎤", key="btn_mic", help="Voice", use_container_width=True)
    with a3:
        st.button("🌐", key="btn_web", help="URL", use_container_width=True)
    with a4:
        st.button("🎨", key="btn_gen", help="Generate", use_container_width=True)

    if st.session_state.get("show_uploader"):
        from ui.components.attachment_panel import render_attachment_panel
        render_attachment_panel()

    col_input, col_send = st.columns([5.5, 0.5])
    with col_input:
        user_text = st.text_input(
            "Composer",
            placeholder="Ask anything… (text, voice, or upload)",
            key="composer_input",
            label_visibility="collapsed"
        )
    with col_send:
        send_clicked = st.button("➤", key="send_btn", use_container_width=True, type="primary", help="Send")

    if send_clicked and (user_text.strip() or st.session_state.get("uploaded_image_b64") or st.session_state.get("voice_audio_bytes")):
        final_text = user_text.strip()
        voice_bytes = st.session_state.get("voice_audio_bytes")

        if not final_text and voice_bytes and st.session_state.get("audio_service"):
            try:
                with st.spinner("Transcribing voice..."):
                    transcript = st.session_state.audio_service.transcribe(voice_bytes)
                    final_text = transcript
            except Exception as e:
                st.error(f"Transcription failed: {e}")

        if not final_text and st.session_state.get("uploaded_image_b64"):
            final_text = "[Image attached] Analyze this image in detail"

        if not final_text:
            st.warning("Enter text or attach image/voice")
            return

        # User message
        attachments_preview = {}
        if st.session_state.get("uploaded_image_name"):
            attachments_preview["image_name"] = st.session_state.uploaded_image_name
        add_message("user", final_text, attachments=attachments_preview)

        registry, pipeline, audio_service = ensure_engine()
        if not pipeline:
            st.error("Engine not booted — set GROQ_API_KEY")
            return

        st.session_state.processing = True
        pipe_attachments = _prepare_attachments()

        with st.status("SAGE pipeline executing…", expanded=False) as status:
            result = pipeline.process(final_text, attachments=pipe_attachments)
            if result.get("success"):
                status.update(label=f"✓ {result.get('agent')} responded", state="complete", expanded=False)
            else:
                status.update(label="Failed", state="error", expanded=False)

        intent = result.get("intent")
        response = result.get("response") or "No response"
        agent = result.get("agent") or "GeneralWorker"

        if intent:
            st.session_state.current_intent = intent

        add_message("assistant", response, intent=intent, agent=agent)

        # Clear transient
        st.session_state.uploaded_image_b64 = None
        st.session_state.uploaded_image_type = None
        st.session_state.show_uploader = False
        st.session_state.voice_audio_bytes = None
        st.session_state.processing = False

        if st.session_state.get("tts_enabled") and audio_service:
            try:
                st.session_state.last_audio = audio_service.synthesize(response)
            except:
                pass

        st.rerun()

    if st.session_state.get("last_audio") and st.session_state.get("tts_enabled"):
        st.audio(st.session_state.last_audio, format="audio/mp3", autoplay=False)
