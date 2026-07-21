"""
ui/components/response_card.py
OWNS: Response body + action bar (Copy, Listen, Save)
EXPOSES: render_response_card()
FORBIDDEN: Pipeline logic
"""
import streamlit as st
from ui.boot import ensure_engine

def render_response_card(content: str, agent: str = "GeneralWorker", intent=None):
    if not content:
        return

    # Header
    timestamp = ""
    if intent:
        # try get from dict
        if isinstance(intent, dict):
            timestamp = intent.get("created_at", "")[:16] if intent.get("created_at") else ""
    # Clean timestamp
    ts_display = ""

    header_html = f"""
    <div class="sage-response-card">
        <div class="sage-response-header">
            <span>📄 {agent} Intelligence Report</span>
            <span style="color:#71717a;">{ts_display}</span>
        </div>
        <div class="sage-response-body">
    """
    st.markdown(header_html, unsafe_allow_html=True)

    # Body - use streamlit markdown for proper rendering
    st.markdown(content)

    st.markdown("</div>", unsafe_allow_html=True)  # close body

    # Action bar using columns
    col1, col2, col3, col4 = st.columns([1,1,1,6])
    with col1:
        if st.button("📋 Copy", key=f"copy_{hash(content)%100000}", use_container_width=False):
            st.code(content, language="markdown")
            st.toast("Copied! Use expander to copy.")
    with col2:
        # Listen button
        if st.button("🔊 Listen", key=f"listen_{hash(content)%100000}"):
            # Ensure audio service
            _, _, audio_service = ensure_engine()
            if audio_service:
                try:
                    audio_bytes = audio_service.synthesize(content)
                    st.audio(audio_bytes, format="audio/mp3", autoplay=True)
                except Exception as e:
                    st.error(f"TTS failed: {e}")
            else:
                st.warning("Audio service unavailable. Check API key.")
    with col3:
        # Save
        st.download_button("💾 Save", data=content, file_name=f"sage_report_{agent}.md", mime="text/markdown", key=f"save_{hash(content)%100000}")

    # Close card
    st.markdown("</div>", unsafe_allow_html=True)
    st.markdown("<div style='height:12px;'></div>", unsafe_allow_html=True)

def render_response_card_compact(content: str):
    """Simpler version for chat history"""
    st.markdown(content)
