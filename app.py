import streamlit as st
import sys
import os
import base64
import io
import time

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
# PREMIUM DARK THEME CSS
# ==========================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    /* ===== GLOBAL ===== */
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }
    
    /* ===== HEADER ===== */
    .sage-hero {
        text-align: center;
        padding: 0.5rem 0 1rem 0;
    }
    .sage-hero h1 {
        font-size: 2.2rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0;
    }
    .sage-hero .subtitle {
        color: #666;
        font-size: 0.85rem;
        font-weight: 400;
        margin-top: 0.1rem;
    }
    
    /* ===== INTENT METADATA TABLE ===== */
    .intent-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.5rem 0;
        font-size: 0.78rem;
        background: #0e1117;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #1e2130;
    }
    .intent-table th {
        background: #161b22;
        color: #8b949e;
        padding: 0.4rem 0.8rem;
        text-align: left;
        font-weight: 500;
        text-transform: uppercase;
        font-size: 0.65rem;
        letter-spacing: 0.5px;
        border-bottom: 1px solid #1e2130;
    }
    .intent-table td {
        padding: 0.4rem 0.8rem;
        color: #e6edf3;
        font-weight: 600;
        border-bottom: 1px solid #1e2130;
    }
    
    /* Color-coded values */
    .val-type { color: #667eea; }
    .val-domain { color: #c9d1d9; }
    .val-priority-LOW { color: #8b949e; }
    .val-priority-NORMAL { color: #f0883e; }
    .val-priority-HIGH { color: #f85149; }
    .val-priority-CRITICAL { color: #ff0000; font-weight: 800; }
    .val-agent { color: #f778ba; }
    .val-confidence { color: #3fb950; }
    .val-status { color: #3fb950; }
    
    /* ===== RESPONSE CARD ===== */
    .response-card {
        background: #0d1117;
        border: 1px solid #1e2130;
        border-radius: 12px;
        padding: 1.2rem;
        margin: 0.5rem 0;
    }
    
    /* ===== ACTION BAR ===== */
    .action-bar {
        display: flex;
        gap: 0.3rem;
        margin-top: 0.8rem;
        padding-top: 0.6rem;
        border-top: 1px solid #1e2130;
    }
    
    /* ===== SIDEBAR NAVIGATION ===== */
    .nav-section {
        background: #161b22;
        border-radius: 8px;
        padding: 0.8rem;
        margin-bottom: 0.8rem;
        border: 1px solid #1e2130;
    }
    .nav-title {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #8b949e;
        margin-bottom: 0.5rem;
        font-weight: 600;
    }
    
    /* ===== SYSTEM STATUS ===== */
    .status-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.3rem;
        font-size: 0.75rem;
    }
    .status-label { color: #8b949e; }
    .status-value { color: #e6edf3; font-weight: 600; text-align: right; }
    .status-online { color: #3fb950; }
    .status-offline { color: #f85149; }
    
    /* ===== TOOLS GRID ===== */
    .tool-item {
        background: #161b22;
        border: 1px solid #1e2130;
        border-radius: 8px;
        padding: 0.5rem 0.7rem;
        margin-bottom: 0.4rem;
        font-size: 0.75rem;
    }
    .tool-item .tool-name { color: #e6edf3; font-weight: 600; }
    .tool-item .tool-desc { color: #8b949e; font-size: 0.65rem; }
    
    /* ===== CLEAN INPUT AREA ===== */
    .input-tools {
        background: #161b22;
        border: 1px solid #1e2130;
        border-radius: 10px;
        padding: 0.6rem;
        margin-bottom: 0.5rem;
    }
    
    /* ===== USER PROFILE ===== */
    .user-profile {
        background: #161b22;
        border-radius: 8px;
        padding: 0.6rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid #1e2130;
    }
    .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        color: white;
        font-weight: 700;
    }
    .user-name { color: #e6edf3; font-weight: 600; font-size: 0.85rem; }
    .user-role { color: #8b949e; font-size: 0.65rem; }
    .pro-badge {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        font-size: 0.55rem;
        font-weight: 700;
        letter-spacing: 0.5px;
    }
    
    /* ===== HIDE STREAMLIT DEFAULTS ===== */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* ===== RESPONSIVE COLUMNS ===== */
    [data-testid="stHorizontalBlock"] {
        gap: 0.8rem;
    }
</style>
""", unsafe_allow_html=True)


# ==========================================
# BOOT FUNCTION
# ==========================================
def boot_sage(api_key: str):
    registry = AgentRegistry()
    registry.register_worker("GeneralWorker", GeneralWorker(api_key=api_key))
    registry.register_worker("WebWorker", WebWorker(api_key=api_key))
    registry.register_worker("VisionWorker", VisionWorker(api_key=api_key))
    pipeline = IntentPipeline(api_key=api_key, registry=registry)
    audio = AudioService(api_key=api_key)
    return pipeline, audio


# ==========================================
# UTILITIES
# ==========================================
def image_to_base64(uploaded_file) -> tuple:
    bytes_data = uploaded_file.read()
    b64_string = base64.b64encode(bytes_data).decode('utf-8')
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


def render_intent_table(intent_data: dict) -> str:
    """Creates the horizontal metadata table like the suggested design."""
    task = intent_data.get('task_type', 'N/A')
    domain = intent_data.get('domain', 'N/A')
    priority = intent_data.get('priority', 'NORMAL')
    agent = intent_data.get('agent', 'N/A')
    confidence = intent_data.get('confidence', 'N/A')
    status = intent_data.get('status', 'N/A')
    output_fmt = intent_data.get('output_format', 'MARKDOWN')
    
    return f"""
    <table class="intent-table">
        <tr>
            <th>Task Type</th>
            <th>Domain</th>
            <th>Priority</th>
            <th>Output</th>
            <th>Agent</th>
            <th>Confidence</th>
            <th>Status</th>
        </tr>
        <tr>
            <td><span class="val-type">{task}</span></td>
            <td><span class="val-domain">{domain}</span></td>
            <td><span class="val-priority-{priority}">{priority}</span></td>
            <td>{output_fmt}</td>
            <td><span class="val-agent">{agent}</span></td>
            <td><span class="val-confidence">{confidence}</span></td>
            <td><span class="val-status">{status} ✅</span></td>
        </tr>
    </table>
    """


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
if "boot_time" not in st.session_state:
    st.session_state.boot_time = None
if "show_tools" not in st.session_state:
    st.session_state.show_tools = False


# ==========================================
# LEFT SIDEBAR (Navigation + Config)
# ==========================================
with st.sidebar:
    # --- Logo ---
    st.markdown("""
    <div style="text-align:center; padding: 0.5rem 0;">
        <img src="https://em-content.zobj.net/source/apple/391/brain_1f9e0.png" width="60">
        <h2 style="margin:0; font-weight:800;">SAGE</h2>
        <p style="color:#8b949e; font-size:0.75rem; margin:0;">v{version} • {tagline}</p>
    </div>
    """.format(version=Settings.APP_VERSION, tagline=Settings.APP_TAGLINE), unsafe_allow_html=True)
    
    st.divider()
    
    # --- API KEY ---
    st.markdown('<div class="nav-title">🔑 API CONFIGURATION</div>', unsafe_allow_html=True)
    
    env_key = Settings.GROQ_API_KEY
    if env_key:
        active_key = env_key.strip()
    else:
        active_key = None
    
    manual_key = st.text_input(
        "API Key",
        type="password",
        placeholder="gsk_... (paste your key)",
        label_visibility="collapsed"
    )
    
    if manual_key:
        cleaned_key = manual_key.strip()
        if cleaned_key.startswith("gsk_") and len(cleaned_key) > 20:
            active_key = cleaned_key
        else:
            st.error("Invalid key format")
            active_key = None
    
    # Boot engine
    if active_key and active_key != st.session_state.active_key:
        with st.spinner("Booting..."):
            try:
                pipeline, audio = boot_sage(active_key)
                st.session_state.pipeline = pipeline
                st.session_state.audio_service = audio
                st.session_state.active_key = active_key
                st.session_state.boot_time = time.time()
            except Exception as e:
                st.error(f"Boot failed: {e}")
    
    st.divider()
    
    # --- SYSTEM STATUS ---
    st.markdown('<div class="nav-title">SYSTEM STATUS</div>', unsafe_allow_html=True)
    
    is_online = st.session_state.pipeline is not None
    status_color = "status-online" if is_online else "status-offline"
    status_text = "Online" if is_online else "Offline"
    
    uptime = "—"
    if st.session_state.boot_time:
        elapsed = int(time.time() - st.session_state.boot_time)
        hours, remainder = divmod(elapsed, 3600)
        minutes, seconds = divmod(remainder, 60)
        uptime = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    
    masked_key = "Not Set"
    if st.session_state.active_key:
        k = st.session_state.active_key
        masked_key = f"{k[:6]}...{k[-4:]}"
    
    st.markdown(f"""
    <div class="nav-section">
        <div class="status-grid">
            <span class="status-label">Engine Status</span>
            <span class="status-value {status_color}">{status_text}</span>
            <span class="status-label">Active Model</span>
            <span class="status-value" style="font-size:0.65rem;">{Settings.DEFAULT_MODEL}</span>
            <span class="status-label">Uptime</span>
            <span class="status-value">{uptime}</span>
            <span class="status-label">Version</span>
            <span class="status-value">SAGE v{Settings.APP_VERSION}</span>
            <span class="status-label">API Key</span>
            <span class="status-value" style="font-size:0.6rem;">{masked_key}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    st.divider()
    
    # --- SETTINGS ---
    st.markdown('<div class="nav-title">⚙️ SETTINGS</div>', unsafe_allow_html=True)
    st.session_state.tts_enabled = st.toggle("🔊 Voice Responses", value=st.session_state.tts_enabled)
    
    st.divider()
    
    # --- SESSION CONTROLS ---
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
            st.session_state.boot_time = None
            st.rerun()
    
    st.divider()
    
    # --- SESSION STATS ---
    if st.session_state.history:
        st.markdown('<div class="nav-title">📊 SESSION STATS</div>', unsafe_allow_html=True)
        total = len(st.session_state.history)
        successful = sum(1 for h in st.session_state.history if h.get("success"))
        rate = (successful / total * 100) if total > 0 else 0
        
        st.markdown(f"""
        <div class="nav-section">
            <div class="status-grid">
                <span class="status-label">Total Queries</span>
                <span class="status-value">{total}</span>
                <span class="status-label">Successful</span>
                <span class="status-value">{successful}</span>
                <span class="status-label">Success Rate</span>
                <span class="status-value status-online">{rate:.1f}%</span>
            </div>
        </div>
        """, unsafe_allow_html=True)
    
    st.divider()
    
    # --- USER PROFILE ---
    st.markdown(f"""
    <div class="user-profile">
        <div class="user-avatar">G</div>
        <div>
            <div class="user-name">gamp</div>
            <div class="user-role">Beginner Builder</div>
        </div>
        <span class="pro-badge">PRO</span>
    </div>
    """, unsafe_allow_html=True)


# ==========================================
# MAIN CONTENT AREA
# ==========================================

# --- HEADER ---
st.markdown("""
<div class="sage-hero">
    <h1>SAGE</h1>
    <p class="subtitle">Think. Understand. Act. Evolve.</p>
</div>
""", unsafe_allow_html=True)

st.divider()

# --- Gate Check ---
if not st.session_state.pipeline:
    st.info("👈 Enter your Groq API key in the sidebar to start.")
    with st.expander("🚀 Quick Start Guide"):
        st.markdown("""
        1. Get a free API key at [console.groq.com](https://console.groq.com)
        2. Paste it in the sidebar
        3. Start asking SAGE anything!
        
        **Examples:**
        - `"Explain how TCP/IP works"`
        - `"Analyze https://example.com"`
        - 📷 Upload an image and ask about it
        - 🎤 Record your voice
        """)
    st.stop()


# ==========================================
# TWO-COLUMN LAYOUT: CHAT + TOOLS
# ==========================================
chat_col, tools_col = st.columns([3, 1])


# ===== RIGHT COLUMN: TOOLS & INSPECTOR =====
with tools_col:
    # --- TOOLS ---
    st.markdown('<div class="nav-title">🛠️ TOOLS</div>', unsafe_allow_html=True)
    
    st.markdown("""
    <div class="tool-item">
        <div class="tool-name">🌐 Web Search</div>
        <div class="tool-desc">Paste a URL to analyze</div>
    </div>
    <div class="tool-item">
        <div class="tool-name">👁️ Image Analysis</div>
        <div class="tool-desc">Upload images for vision</div>
    </div>
    <div class="tool-item">
        <div class="tool-name">🎤 Voice Input</div>
        <div class="tool-desc">Speak your query</div>
    </div>
    <div class="tool-item">
        <div class="tool-name">🔊 Text to Speech</div>
        <div class="tool-desc">Listen to responses</div>
    </div>
    """, unsafe_allow_html=True)
    
    st.markdown("---")
    
    # --- ATTACHMENTS ---
    st.markdown('<div class="nav-title">📎 ATTACHMENTS</div>', unsafe_allow_html=True)
    
    uploaded_image = st.file_uploader(
        "Upload Image",
        type=["jpg", "jpeg", "png", "webp", "gif"],
        key="image_uploader",
        label_visibility="collapsed"
    )
    
    if uploaded_image:
        st.image(uploaded_image, use_container_width=True)
        b64, img_type = image_to_base64(uploaded_image)
        st.session_state.pending_image = {
            "image_base64": b64,
            "image_type": img_type
        }
        st.success(f"📎 {uploaded_image.name}")
    else:
        st.session_state.pending_image = None
    
    st.markdown("---")
    
    # --- VOICE INPUT ---
    st.markdown('<div class="nav-title">🎤 VOICE INPUT</div>', unsafe_allow_html=True)
    
    audio_input = st.audio_input(
        "Record",
        key="voice_input",
        label_visibility="collapsed"
    )
    
    if audio_input and st.session_state.audio_service:
        with st.spinner("Transcribing..."):
            try:
                audio_bytes = audio_input.read()
                transcribed = st.session_state.audio_service.transcribe(audio_bytes)
                st.info(f"🎤 \"{transcribed}\"")
                
                attachments = st.session_state.pending_image or {}
                result = st.session_state.pipeline.process(transcribed, attachments)
                
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
                st.error(f"Failed: {e}")
    
    st.markdown("---")
    
    # --- LAST INTENT INSPECTOR ---
    if st.session_state.history:
        last = st.session_state.history[-1]
        if last.get("success") and last.get("intent_data"):
            st.markdown('<div class="nav-title">🔍 INTENT INSPECTOR</div>', unsafe_allow_html=True)
            
            idata = last["intent_data"]
            priority = idata.get('priority', 'NORMAL')
            
            st.markdown(f"""
            <div class="nav-section">
                <div class="status-grid">
                    <span class="status-label">Task Type</span>
                    <span class="status-value val-type">{idata.get('task_type', 'N/A')}</span>
                    <span class="status-label">Domain</span>
                    <span class="status-value">{idata.get('domain', 'N/A')}</span>
                    <span class="status-label">Priority</span>
                    <span class="status-value val-priority-{priority}">▸ {priority}</span>
                    <span class="status-label">Output Format</span>
                    <span class="status-value">{idata.get('output_format', 'MARKDOWN')}</span>
                    <span class="status-label">Agent</span>
                    <span class="status-value val-agent">{idata.get('agent', 'N/A')}</span>
                    <span class="status-label">Confidence</span>
                    <span class="status-value val-confidence">{idata.get('confidence', 'N/A')}</span>
                    <span class="status-label">Status</span>
                    <span class="status-value val-status">{idata.get('status', 'N/A')} ✅</span>
                </div>
            </div>
            """, unsafe_allow_html=True)


# ===== LEFT COLUMN: CHAT =====
with chat_col:
    
    # --- WELCOME MESSAGE (Only when no history) ---
    if not st.session_state.history:
        st.markdown("""
        <div style="text-align:center; padding: 2rem 0;">
            <h3 style="color:#e6edf3;">👋 Welcome back, gamp</h3>
            <p style="color:#8b949e;">How can I help accelerate your intelligence today?</p>
        </div>
        """, unsafe_allow_html=True)
    
    # --- CHAT HISTORY ---
    for idx, exchange in enumerate(st.session_state.history):
        
        # USER MESSAGE
        st.chat_message("user").write(exchange["user"])
        
        # SAGE RESPONSE
        with st.chat_message("assistant", avatar="🧠"):
            
            # Intent metadata table (if successful)
            if exchange.get("success") and exchange.get("intent_data"):
                idata = exchange["intent_data"]
                
                # Add output_format if missing (backward compatibility)
                if "output_format" not in idata:
                    idata["output_format"] = "MARKDOWN"
                if "priority" not in idata:
                    idata["priority"] = "NORMAL"
                
                st.markdown("**✅ Intent Recognized**")
                st.markdown(render_intent_table(idata), unsafe_allow_html=True)
            
            # Response content
            st.markdown(exchange["response"])
            
            # --- ACTION BAR ---
            action_cols = st.columns([1, 1, 1, 4])
            
            # COPY BUTTON
            with action_cols[0]:
                if st.button("📋 Copy", key=f"copy_{idx}", use_container_width=True):
                    st.code(exchange["response"], language=None)
            
            # LISTEN BUTTON
            with action_cols[1]:
                if st.session_state.tts_enabled and exchange.get("success"):
                    audio_cache_key = f"audio_{idx}"
                    if audio_cache_key not in st.session_state:
                        if st.button("🔊 Listen", key=f"listen_{idx}", use_container_width=True):
                            try:
                                audio_bytes = st.session_state.audio_service.synthesize(
                                    exchange["response"]
                                )
                                st.session_state[audio_cache_key] = audio_bytes
                                st.rerun()
                            except Exception as e:
                                st.error(f"TTS: {e}")
                    else:
                        st.audio(st.session_state[audio_cache_key], format="audio/mp3")
            
            # DOWNLOAD BUTTON
            with action_cols[2]:
                st.download_button(
                    "⬇️ Save",
                    data=exchange["response"],
                    file_name=f"sage_response_{idx}.md",
                    mime="text/markdown",
                    key=f"dl_{idx}",
                    use_container_width=True
                )
    
    # --- TEXT INPUT BAR ---
    prompt = st.chat_input("Ask anything... (text, voice, or upload)")
    
    if prompt:
        attachments = st.session_state.pending_image or {}
        
        display_text = prompt
        if attachments:
            display_text = f"📷 [Image Attached] {prompt}"
        
        st.chat_message("user").write(display_text)
        
        with st.chat_message("assistant", avatar="🧠"):
            with st.spinner("⚡ Processing through SAGE Pipeline..."):
                
                result = st.session_state.pipeline.process(prompt, attachments)
                
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
                    
                    st.markdown("**✅ Intent Recognized**")
                    st.markdown(render_intent_table(intent_data), unsafe_allow_html=True)
                    st.markdown(result["response"])
                    
                    # Auto TTS
                    if st.session_state.tts_enabled and st.session_state.audio_service:
                        try:
                            tts_bytes = st.session_state.audio_service.synthesize(
                                result["response"]
                            )
                            st.audio(tts_bytes, format="audio/mp3")
                        except Exception:
                            pass
                    
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
        
        st.session_state.pending_image = None
        st.rerun()