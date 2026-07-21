"""
ui/components/attachment_panel.py
OWNS: Image upload + voice recording widgets
EXPOSES: render_attachment_panel()
FORBIDDEN: Pipeline execution
"""
import streamlit as st
import base64
from config.settings import Settings

def _image_to_base64(uploaded_file):
    try:
        bytes_data = uploaded_file.getvalue()
        # Check size
        size_mb = len(bytes_data) / (1024*1024)
        if size_mb > Settings.MAX_IMAGE_SIZE_MB:
            st.error(f"Image too large: {size_mb:.1f}MB > {Settings.MAX_IMAGE_SIZE_MB}MB")
            return None
        b64 = base64.b64encode(bytes_data).decode('utf-8')
        # Determine type
        name = uploaded_file.name.lower()
        if name.endswith(".png"):
            img_type = "png"
        elif name.endswith((".jpg",".jpeg")):
            img_type = "jpeg"
        elif name.endswith(".webp"):
            img_type = "webp"
        else:
            img_type = "jpeg"
        return b64, img_type, bytes_data
    except Exception as e:
        st.error(f"Image processing failed: {e}")
        return None

def render_attachment_panel():
    # This renders compact upload UI for vision and voice
    # Image upload
    st.markdown('<div class="sage-status-header">📎 Upload Image for Analysis</div>', unsafe_allow_html=True)
    uploaded = st.file_uploader(
        "Upload Image",
        type=["png","jpg","jpeg","webp"],
        key="img_uploader",
        label_visibility="collapsed"
    )

    if uploaded:
        result = _image_to_base64(uploaded)
        if result:
            b64, img_type, raw_bytes = result
            st.session_state.uploaded_image = uploaded
            st.session_state.uploaded_image_b64 = b64
            st.session_state.uploaded_image_type = img_type
            st.session_state.uploaded_image_name = uploaded.name

            # Preview
            st.image(uploaded, width=200)
            st.success(f"✅ image attached ({img_type.upper()}) — ready for VisionWorker")
        else:
            st.session_state.uploaded_image = None
            st.session_state.uploaded_image_b64 = None

    # Voice recording - using audio_input (Streamlit 1.35+)
    st.markdown('<div class="sage-status-header" style="margin-top:16px;">🎤 Record Voice Message</div>', unsafe_allow_html=True)
    audio_val = st.audio_input("Record", key="voice_recorder", label_visibility="collapsed")

    if audio_val:
        try:
            audio_bytes = audio_val.getvalue()
            if len(audio_bytes) > 0:
                st.session_state.voice_audio_bytes = audio_bytes
                st.audio(audio_bytes, format="audio/wav")
                st.info("🎤 Voice captured — will be transcribed on send if you enable voice in composer.")
        except Exception as e:
            st.error(f"Voice capture failed: {e}")

    # Show attachment status if exists
    if st.session_state.get("uploaded_image_b64"):
        st.markdown(f"""
        <div style="margin-top:10px; background: rgba(63,185,80,0.1); border:1px solid rgba(63,185,80,0.2); border-radius:8px; padding:8px 12px; font-size:11px; color:#3fb950;">
            ✅ {st.session_state.uploaded_image_name} attached — {len(st.session_state.uploaded_image_b64)//1024}KB base64
        </div>
        """, unsafe_allow_html=True)
