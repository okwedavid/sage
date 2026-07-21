"""
OWNS: File upload (images) and voice recording UI.
EXPOSES: render_attachments()
FORBIDDEN: Must never process files through the pipeline.
"""

import base64
import streamlit as st
from ui.state import add_to_history


def render_attachments():
    """Renders the image upload and voice input widgets."""
    
    _render_image_upload()
    st.markdown("---")
    _render_voice_input()


def _render_image_upload():
    """Image file uploader with preview."""
    st.markdown(
        '<div class="nav-title">📎 ATTACHMENTS</div>', 
        unsafe_allow_html=True
    )
    
    uploaded = st.file_uploader(
        "Upload Image",
        type=["jpg", "jpeg", "png", "webp", "gif"],
        key="image_uploader",
        label_visibility="collapsed"
    )
    
    if uploaded:
        st.image(uploaded, use_container_width=True)
        
        bytes_data = uploaded.read()
        b64 = base64.b64encode(bytes_data).decode("utf-8")
        
        name = uploaded.name.lower()
        if name.endswith(".png"):
            img_type = "png"
        elif name.endswith(".webp"):
            img_type = "webp"
        elif name.endswith(".gif"):
            img_type = "gif"
        else:
            img_type = "jpeg"
        
        st.session_state.pending_image = {
            "image_base64": b64,
            "image_type": img_type
        }
        st.success(f"📎 {uploaded.name}")
    else:
        st.session_state.pending_image = None


def _render_voice_input():
    """Microphone recording widget."""
    st.markdown(
        '<div class="nav-title">🎤 VOICE INPUT</div>', 
        unsafe_allow_html=True
    )
    
    audio_input = st.audio_input(
        "Record",
        key="voice_input",
        label_visibility="collapsed"
    )
    
    if audio_input and st.session_state.audio_service:
        with st.spinner("🎤 Transcribing..."):
            try:
                audio_bytes = audio_input.read()
                transcribed = st.session_state.audio_service.transcribe(audio_bytes)
                st.info(f'🎤 "{transcribed}"')
                
                # Process through pipeline
                attachments = st.session_state.pending_image or {}
                result = st.session_state.pipeline.process(transcribed, attachments)
                
                intent_data = {}
                if result["success"]:
                    intent = result["intent"]
                    intent_data = {
                        "task_type": intent.task_type.name,
                        "domain": intent.target_domain,
                        "agent": result["agent"],
                        "confidence": f"{intent.confidence_score:.0%}",
                        "status": intent.status.name,
                        "priority": intent.priority.name,
                        "output_format": intent.output_format.name
                    }
                
                add_to_history({
                    "user": f"🎤 *{transcribed}*",
                    "response": result["response"],
                    "intent_data": intent_data,
                    "success": result["success"]
                })
                
                st.session_state.pending_image = None
                st.rerun()
                
            except Exception as e:
                st.error(f"Failed: {e}")