import streamlit as st
import sys
import os
import base64
import io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import Settings
from core.intent.pipeline import IntentPipeline
from core.intent.enums import TaskType, Status
from agents.registry import AgentRegistry
from agents.general_worker import GeneralWorker
from agents.web_worker import WebWorker
from agents.vision_worker import VisionWorker
from services.audio_service import AudioService

# ==========================================
# PAGE CONFIG
# ==========================================
st.set_page_config(
    page_title=f"{Settings.APP_NAME} | {Settings.APP_TAGLINE}",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ==========================================
# STYLING
# ==========================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
    html, body, [class*="css"] { font-family: 'Inter', sans-serif; }
    
    .sage-header { text-align: center; padding: 1rem 0; }
    .sage-header h1 {
        font-size: 3rem; font-weight: 800;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0;
    }
    .sage-header p { color: #888; font-size: 1rem; }
    
    .intent-tag {
        display: inline-block; padding: 0.2rem 0.6rem;
        border-radius: 12px; font-size: 0.75rem;
        margin-right: 0.4rem; margin-bottom: 0.3rem; color: #fff;
    }
    .tag-type { background: #667eea; }
    .tag-domain { background: #764ba2; }
    .tag-agent { background: #e91e63; }
    .tag-status { background: #4CAF50; }
    .tag-confidence { background: #ff9800; }
    
    .attachment-bar {
        background: #1a1a2e;
        border: 1px dashed #444;
        border-radius: 10px;
        padding: 0.8rem;
        margin-bottom: 1rem;
    }
</style>
""", unsafe_allow_html=True)


# ==========================================
# BOOT FUNCTION
# ==========================================
def boot_sage(api_key: str):
    """Initializes all SAGE components."""
    registry = AgentRegistry()
    
    general = GeneralWorker(api_key=api_key)
    registry.register_worker("GeneralWorker", general)
    
    web = WebWorker(api_key=api_key)
    registry.register_worker("WebWorker", web)
    
    vision = VisionWorker(api_key=api_key)
    registry.register_worker("VisionWorker", vision)
    
    pipeline = IntentPipeline(api_key=api_key, registry=registry)
    audio = AudioService(api_key=api_key)
    
    return pipeline, audio


# ==========================================
# UTILITY FUNCTIONS
# ==========================================
def image_to_base64(uploaded_file) -> tuple:
    """
    Converts an uploaded image file to base64 string.
    Returns: (base64_string, image_type)
    """
    bytes_data = uploaded_file.read()
    b64_string = base64.b64encode(bytes_data).decode('utf-8')
    
    # Determine image type from filename
    name = uploaded_file.name.lower()
    if name.endswith('.png'):
        img_type = 'png'
    elif name.endswith('.webp'):
        img_type = 'webp'
    elif name.endswith('.gif'):
        img_type = 'gif'
    else:
        img_type = 'jpeg'
    
    return b64_string, img_type


# ==========================================
# SESSION STATE
# ==========================================
if "history" not in st.session_state:
    st.session_state.history = []
if "pipeline" not in st.session_state:
    st.session_state.pipeline = None
if "audio_service" not in st.session_state:
    st.session_state.audio_service = None
if "active_key" not in st.session_state:
    st.session_state.active_key = None
if "pending_image" not in st.session_state:
    st.session_state.pending_image = None
if "tts_enabled" not in st.session_state:
    st.session_state.tts_enabled = True


# ==========================================
# SIDEBAR
# ==========================================
with st.sidebar:
    st.image("https://em-content.zobj.net/source/apple/391/brain_1f9e0.png", width=80)
    st.markdown(f"### {Settings.APP_NAME} v{Settings.APP_VERSION}")
    st.caption(Settings.APP_TAGLINE)
    
    st.divider()
    
    # --- API Key ---
    st.markdown("#### 🔑 API Configuration")
    env_key = Settings.GROQ_API_KEY
    
    if env_key:
        st.success(f"Server Key: `{Settings.get_masked_key()}`")
        active_key = env_key.strip()
    else:
        st.warning("No server key found.")
        active_key = None
    
    manual_key = st.text_input(
        "Use Your Own Key (Optional)", 
        type="password", 
        placeholder="gsk_..."
    )
    
    if manual_key:
        cleaned_key = manual_key.strip()
        if cleaned_key.startswith("gsk_") and len(cleaned_key) > 20:
            active_key = cleaned_key
            st.success(f"✅ Using: `{cleaned_key[:6]}...{cleaned_key[-4:]}`")
        else:
            st.error("❌ Invalid format. Must start with 'gsk_'")
            active_key = None
    
    # Boot engine if key changed
    if active_key and active_key != st.session_state.active_key:
        with st.spinner("Booting SAGE..."):
            try:
                pipeline, audio = boot_sage(active_key)
                st.session_state.pipeline = pipeline
                st.session_state.audio_service = audio
                st.session_state.active_key = active_key
                st.success("🟢 Engine Online")
            except Exception as e:
                st.error(f"Boot failed: {e}")
    
    st.divider()
    
    # --- Audio Settings ---
    st.markdown("#### 🔊 Audio Settings")
    st.session_state.tts_enabled = st.toggle(
        "Enable Voice Responses", 
        value=st.session_state.tts_enabled
    )
    
    st.divider()
    
    # --- Capabilities ---
    st.markdown("#### ⚡ Active Capabilities")
    st.markdown("""
    - 🧠 **Text Analysis** — Research, Explain, Debug
    - 🌐 **Web Reading** — Paste any URL
    - 👁️ **Computer Vision** — Upload images
    - 🎤 **Voice Input** — Speak your query
    - 🔊 **Voice Output** — Listen to responses
    - 📋 **Copy Output** — One-click clipboard
    """)
    
    st.divider()
    
    # --- Session Controls ---
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🗑️ Clear", use_container_width=True):
            st.session_state.history = []
            st.session_state.pending_image = None
            st.rerun()
    with col2:
        if st.button("🔄 Reboot", use_container_width=True):
            st.session_state.pipeline = None
            st.session_state.audio_service = None
            st.session_state.active_key = None
            st.session_state.pending_image = None
            st.rerun()
    
    # --- Stats ---
    if st.session_state.history:
        st.divider()
        st.markdown("#### 📊 Session Stats")
        total = len(st.session_state.history)
        successful = sum(1 for h in st.session_state.history if h.get("success"))
        s1, s2 = st.columns(2)
        s1.metric("Queries", total)
        s2.metric("Success", f"{(successful/total*100):.0f}%" if total > 0 else "0%")


# ==========================================
# MAIN INTERFACE
# ==========================================

st.markdown("""
<div class="sage-header">
    <h1>🧠 SAGE</h1>
    <p>See. Listen. Think. Respond.</p>
</div>
""", unsafe_allow_html=True)

st.divider()

# --- Gate Check ---
if not st.session_state.pipeline:
    st.info("👈 Please configure your API key in the sidebar to start.")
    with st.expander("🚀 Quick Start Guide"):
        st.markdown("""
        1. Get a free API key at [console.groq.com](https://console.groq.com)
        2. Paste it in the sidebar
        3. Start asking SAGE anything!
        
        **Try these:**
        - `"Explain quantum computing"` → Text Analysis
        - `"Analyze https://example.com"` → Web Reading
        - 📷 Upload an image → Computer Vision
        - 🎤 Record your voice → Speech Input
        """)
    st.stop()


# ==========================================
# MULTIMODAL INPUT BAR
# ==========================================
with st.container():
    input_col1, input_col2 = st.columns([1, 1])
    
    # --- IMAGE UPLOAD ---
    with input_col1:
        uploaded_image = st.file_uploader(
            "📷 Upload Image for Analysis",
            type=["jpg", "jpeg", "png", "webp", "gif"],
            key="image_uploader",
            help="SAGE will analyze the image using computer vision"
        )
        
        if uploaded_image:
            # Show preview
            st.image(uploaded_image, caption="📎 Attached", width=200)
            
            # Convert and store
            b64, img_type = image_to_base64(uploaded_image)
            st.session_state.pending_image = {
                "image_base64": b64,
                "image_type": img_type
            }
            st.success(f"✅ Image attached ({img_type.upper()})")
        else:
            st.session_state.pending_image = None
    
    # --- VOICE INPUT ---
    with input_col2:
        audio_input = st.audio_input(
            "🎤 Record Voice Message",
            key="voice_input",
            help="SAGE will transcribe your speech and process it"
        )
        
        if audio_input and st.session_state.audio_service:
            with st.spinner("🎤 Transcribing your voice..."):
                try:
                    audio_bytes = audio_input.read()
                    transcribed = st.session_state.audio_service.transcribe(audio_bytes)
                    st.info(f"🎤 Heard: *\"{transcribed}\"*")
                    
                    # Auto-process the transcribed text
                    attachments = st.session_state.pending_image or {}
                    result = st.session_state.pipeline.process(transcribed, attachments)
                    
                    # Build response data
                    if result["success"]:
                        intent = result["intent"]
                        intent_data = {
                            "task_type": intent.task_type.name,
                            "domain": intent.target_domain,
                            "agent": result["agent"],
                            "confidence": f"{intent.confidence_score:.0%}",
                            "status": intent.status.name
                        }
                    else:
                        intent_data = {}
                    
                    st.session_state.history.append({
                        "user": f"🎤 *{transcribed}*",
                        "response": result["response"],
                        "intent_data": intent_data,
                        "success": result["success"]
                    })
                    
                    st.session_state.pending_image = None
                    st.rerun()
                    
                except Exception as e:
                    st.error(f"Transcription failed: {e}")


# ==========================================
# CHAT HISTORY DISPLAY
# ==========================================
chat_container = st.container()

with chat_container:
    for idx, exchange in enumerate(st.session_state.history):
        # User message
        st.chat_message("user").write(exchange["user"])
        
        # SAGE response
        with st.chat_message("assistant", avatar="🧠"):
            if exchange.get("success"):
                intent_data = exchange.get("intent_data", {})
                tags_html = f"""
                <div style="margin-bottom: 0.5rem;">
                    <span class="intent-tag tag-type">🏷️ {intent_data.get('task_type', 'N/A')}</span>
                    <span class="intent-tag tag-domain">🎯 {intent_data.get('domain', 'N/A')}</span>
                    <span class="intent-tag tag-agent">🤖 {intent_data.get('agent', 'N/A')}</span>
                    <span class="intent-tag tag-confidence">📊 {intent_data.get('confidence', 'N/A')}</span>
                    <span class="intent-tag tag-status">✅ {intent_data.get('status', 'N/A')}</span>
                </div>
                """
                st.markdown(tags_html, unsafe_allow_html=True)
            
            st.markdown(exchange["response"])
            
            # Audio playback + Copy
            if exchange.get("success"):
                audio_col, copy_col = st.columns([1, 1])
                
                with audio_col:
                    # TTS playback button
                    if st.session_state.tts_enabled:
                        audio_key = f"tts_{idx}"
                        if f"audio_{idx}" not in st.session_state:
                            if st.button(f"🔊 Listen", key=audio_key):
                                try:
                                    audio_bytes = st.session_state.audio_service.synthesize(
                                        exchange["response"]
                                    )
                                    st.session_state[f"audio_{idx}"] = audio_bytes
                                    st.rerun()
                                except Exception as e:
                                    st.error(f"TTS failed: {e}")
                        else:
                            st.audio(
                                st.session_state[f"audio_{idx}"], 
                                format="audio/mp3"
                            )
                
                with copy_col:
                    with st.expander("📋 Copy"):
                        st.code(exchange["response"], language=None)


# ==========================================
# TEXT INPUT (Chat Bar)
# ==========================================
prompt = st.chat_input("Ask SAGE anything... (paste URLs, upload images, or type)")

if prompt:
    # Gather attachments
    attachments = st.session_state.pending_image or {}
    
    # Display user message
    display_text = prompt
    if attachments:
        display_text = f"📷 [Image Attached] {prompt}"
    
    st.chat_message("user").write(display_text)
    
    with st.chat_message("assistant", avatar="🧠"):
        with st.spinner("⚡ Processing through SAGE Pipeline..."):
            
            # Execute full pipeline with attachments
            result = st.session_state.pipeline.process(prompt, attachments)
            
            if result["success"]:
                intent = result["intent"]
                intent_data = {
                    "task_type": intent.task_type.name,
                    "domain": intent.target_domain,
                    "agent": result["agent"],
                    "confidence": f"{intent.confidence_score:.0%}",
                    "status": intent.status.name
                }
                
                tags_html = f"""
                <div style="margin-bottom: 0.5rem;">
                    <span class="intent-tag tag-type">🏷️ {intent_data['task_type']}</span>
                    <span class="intent-tag tag-domain">🎯 {intent_data['domain']}</span>
                    <span class="intent-tag tag-agent">🤖 {intent_data['agent']}</span>
                    <span class="intent-tag tag-confidence">📊 {intent_data['confidence']}</span>
                    <span class="intent-tag tag-status">✅ {intent_data['status']}</span>
                </div>
                """
                st.markdown(tags_html, unsafe_allow_html=True)
                st.markdown(result["response"])
                
                # Auto-generate TTS if enabled
                if st.session_state.tts_enabled and st.session_state.audio_service:
                    try:
                        tts_bytes = st.session_state.audio_service.synthesize(
                            result["response"]
                        )
                        st.audio(tts_bytes, format="audio/mp3")
                    except Exception:
                        pass  # Silent fail for TTS
                
                st.session_state.history.append({
                    "user": display_text,
                    "response": result["response"],
                    "intent_data": intent_data,
                    "success": True
                })
            else:
                st.error(f"⚠️ {result['response']}")
                st.session_state.history.append({
                    "user": display_text,
                    "response": result["response"],
                    "success": False
                })
    
    # Clear the pending image after processing
    st.session_state.pending_image = None
    st.rerun()