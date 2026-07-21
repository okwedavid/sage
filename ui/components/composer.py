"""
ui/components/composer.py
OWNS: Universal text input handler + pipeline execution
EXPOSES: render_composer()
FORBIDDEN: Sidebar rendering
"""
import streamlit as st
from ui.state import add_message
from ui.boot import ensure_engine
from ui.components.intent_card import render_intent_card
from ui.components.response_card import render_response_card
from ui.components.pipeline_viz import render_pipeline_viz
import base64

def _prepare_attachments():
    attachments = {}
    if st.session_state.get("uploaded_image_b64"):
        attachments["image_base64"] = st.session_state.uploaded_image_b64
        attachments["image_type"] = st.session_state.get("uploaded_image_type", "jpeg")
        attachments["image_name"] = st.session_state.get("uploaded_image_name", "image")
    return attachments

def render_composer():
    # Attachment panel quick toggles row above composer
    # Main composer with text input + send

    # Check for voice transcript request
    voice_bytes = st.session_state.get("voice_audio_bytes")
    placeholder_text = "Ask SAGE anything… (paste URLs, upload images, or type)"

    # Use columns for composer like target image
    col_input, col_actions = st.columns([6, 1])

    with col_input:
        user_text = st.text_input(
            "Composer",
            placeholder=placeholder_text,
            key="composer_input",
            label_visibility="collapsed"
        )

    with col_actions:
        send_clicked = st.button("▶", key="send_btn", use_container_width=True, help="Send message")

    # Additional action row: attach, mic, web, generate
    a1, a2, a3, a4, a5 = st.columns([1,1,1,1,4])
    with a1:
        if st.button("📎", key="btn_attach", help="Attach image"):
            st.session_state.show_uploader = not st.session_state.get("show_uploader", False)
    with a2:
        if st.button("🎤", key="btn_mic", help="Voice input"):
            st.toast("Use voice recorder in left panel attachments")
    with a3:
        if st.button("🌐", key="btn_web", help="Add URL"):
            st.toast("Just paste any https:// URL in your message")
    with a4:
        if st.button("🎨", key="btn_gen", help="Generate"):
            st.toast("Image generation coming in Sprint 11")

    # Show uploader if toggled
    if st.session_state.get("show_uploader"):
        from ui.components.attachment_panel import render_attachment_panel
        render_attachment_panel()

    # Process send
    if send_clicked and (user_text.strip() or st.session_state.get("uploaded_image_b64") or voice_bytes):
        # If voice exists but no text, transcribe first
        final_text = user_text.strip()
        if not final_text and voice_bytes and st.session_state.get("audio_service"):
            try:
                with st.spinner("🎤 Transcribing voice..."):
                    transcript = st.session_state.audio_service.transcribe(voice_bytes)
                    final_text = transcript
                    st.session_state.voice_transcript = transcript
                    st.toast(f"Transcribed: {transcript[:50]}...")
            except Exception as e:
                st.error(f"Transcription failed: {e}")
                final_text = ""

        if not final_text and st.session_state.get("uploaded_image_b64"):
            final_text = "[Image attached] Analyze this image"

        if not final_text:
            st.warning("Please enter text or attach image/voice")
            return

        # Add user message
        attachments_preview = {}
        if st.session_state.get("uploaded_image_name"):
            attachments_preview["image_name"] = st.session_state.uploaded_image_name

        add_message("user", final_text, attachments=attachments_preview)

        # Ensure engine
        registry, pipeline, audio_service = ensure_engine()
        if not pipeline:
            st.error("🔑 Engine not booted. Please set GROQ_API_KEY in .env or sidebar.")
            return

        st.session_state.processing = True
        st.session_state.current_intent = None

        # Prepare attachments for pipeline
        pipe_attachments = _prepare_attachments()

        # Execute pipeline with live viz
        with st.status("🧠 SAGE is thinking...", expanded=True) as status:
            st.write("📝 Normalizing input...")
            st.write("🧠 Classifying intent...")
            # Actual process
            result = pipeline.process(final_text, attachments=pipe_attachments)
            st.write(f"🔍 Validating ({result.get('intent').confidence_score:.0%} confidence)" if result.get('intent') else "🔍 Validating...")
            if result.get('agent'):
                st.write(f"🔀 Routing → {result.get('agent')}")
                st.write(f"⚡ Executing via {result.get('agent')}...")
            if result.get("success"):
                st.write(f"✅ Completed: {result['intent'].status.name}")
            else:
                st.write(f"⚠️ {result.get('response','Failed')[:100]}")
            status.update(label=f"✅ {result.get('agent','SAGE')} responded", state="complete" if result.get("success") else "error", expanded=False)

        # Save results
        intent = result.get("intent")
        response = result.get("response") or "No response generated"
        agent = result.get("agent") or "GeneralWorker"

        if intent:
            st.session_state.current_intent = intent

        # Add assistant message
        add_message("assistant", response, intent=intent, agent=agent)

        # Clear attachments after send? Keep for inspector but clear uploader flag
        # Optionally keep image for inspector display - clear b64 after?
        # Let's keep name but clear b64 to avoid re-sending accidentally
        # Actually clear after successful send to match UX where you re-attach each time
        st.session_state.uploaded_image_b64 = None
        st.session_state.uploaded_image_type = None
        st.session_state.show_uploader = False
        st.session_state.voice_audio_bytes = None
        st.session_state.processing = False

        # Auto TTS if enabled
        if st.session_state.get("tts_enabled") and audio_service:
            try:
                audio_bytes = audio_service.synthesize(response)
                st.session_state.last_audio = audio_bytes
            except Exception as e:
                st.session_state.last_audio = None

        st.rerun()

    # If there's last audio, show player (for UX)
    if st.session_state.get("last_audio") and st.session_state.get("tts_enabled"):
        st.audio(st.session_state.last_audio, format="audio/mp3", autoplay=False)
