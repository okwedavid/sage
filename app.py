import streamlit as st
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import Settings
from core.intent.pipeline import IntentPipeline
from core.intent.enums import TaskType, Status
from agents.registry import AgentRegistry
from agents.general_worker import GeneralWorker
from agents.web_worker import WebWorker

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
# STYLING + CLIPBOARD JS
# ==========================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
    html, body, [class*="css"] { font-family: 'Inter', sans-serif; }
    
    .sage-header {
        text-align: center;
        padding: 1rem 0;
    }
    .sage-header h1 {
        font-size: 3rem;
        font-weight: 800;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0;
    }
    .sage-header p {
        color: #888;
        font-size: 1rem;
    }
    
    .intent-tag {
        display: inline-block;
        padding: 0.2rem 0.6rem;
        border-radius: 12px;
        font-size: 0.75rem;
        margin-right: 0.4rem;
        margin-bottom: 0.3rem;
        color: #fff;
    }
    .tag-type { background: #667eea; }
    .tag-domain { background: #764ba2; }
    .tag-agent { background: #e91e63; }
    .tag-status { background: #4CAF50; }
    .tag-confidence { background: #ff9800; }
    
    .copy-btn {
        background: #333;
        color: #fff;
        border: 1px solid #555;
        padding: 0.3rem 0.8rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
        margin-top: 0.5rem;
    }
    .copy-btn:hover { background: #555; }
    
    .feature-badge {
        display: inline-block;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 0.15rem 0.5rem;
        border-radius: 10px;
        font-size: 0.65rem;
        margin-left: 0.3rem;
    }
</style>

<script>
function copyToClipboard(elementId) {
    var text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text).then(function() {
        // Show brief confirmation
        var btn = event.target;
        btn.innerText = '✅ Copied!';
        setTimeout(function(){ btn.innerText = '📋 Copy'; }, 1500);
    });
}
</script>
""", unsafe_allow_html=True)


# ==========================================
# BOOT FUNCTION (No caching — dynamic keys)
# ==========================================
def boot_sage(api_key: str) -> IntentPipeline:
    """
    Initializes the full SAGE pipeline with all available workers.
    Called once per session, stored in session_state.
    """
    registry = AgentRegistry()
    
    # Register TEXT workers
    general = GeneralWorker(api_key=api_key)
    registry.register_worker("GeneralWorker", general)
    
    # Register WEB worker
    web = WebWorker(api_key=api_key)
    registry.register_worker("WebWorker", web)
    
    # Future: Register Image/Video workers here
    # image = ImageWorker(api_key=stability_key)
    # registry.register_worker("ImageWorker", image)
    
    pipeline = IntentPipeline(api_key=api_key, registry=registry)
    return pipeline


# ==========================================
# SESSION STATE
# ==========================================
if "history" not in st.session_state:
    st.session_state.history = []
if "pipeline" not in st.session_state:
    st.session_state.pipeline = None
if "active_key" not in st.session_state:
    st.session_state.active_key = None


# ==========================================
# SIDEBAR
# ==========================================
with st.sidebar:
    st.image("https://em-content.zobj.net/source/apple/391/brain_1f9e0.png", width=80)
    st.markdown(f"### {Settings.APP_NAME} v{Settings.APP_VERSION}")
    st.caption(Settings.APP_TAGLINE)
    
    st.divider()
    
    # --- API Key Management ---
    st.markdown("#### 🔑 API Configuration")
    
    # Check .env first
    env_key = Settings.GROQ_API_KEY
    
    if env_key:
        st.success(f"Server Key: `{Settings.get_masked_key()}`")
        active_key = env_key.strip()
    else:
        st.warning("No server key found.")
        active_key = None
    
    # Manual override (always available)
    st.markdown(
        "**Use Your Own Key** <span class='feature-badge'>Optional</span>", 
        unsafe_allow_html=True
    )
    manual_key = st.text_input(
        "Groq API Key", 
        type="password", 
        placeholder="gsk_...",
        label_visibility="collapsed"
    )
    
    if manual_key:
        # THE FIX: Strip whitespace and validate format
        cleaned_key = manual_key.strip()
        if cleaned_key.startswith("gsk_") and len(cleaned_key) > 20:
            active_key = cleaned_key
            st.success(f"✅ Using: `{cleaned_key[:6]}...{cleaned_key[-4:]}`")
        else:
            st.error("❌ Invalid key format. Must start with 'gsk_'")
            active_key = None
    
    # Boot or reboot pipeline if key changed
    if active_key and active_key != st.session_state.active_key:
        with st.spinner("Booting SAGE Engine..."):
            try:
                st.session_state.pipeline = boot_sage(active_key)
                st.session_state.active_key = active_key
                st.success("🟢 Engine Online")
            except Exception as e:
                st.error(f"Boot failed: {e}")
                st.session_state.pipeline = None
    
    st.divider()
    
    # --- Capabilities ---
    st.markdown("#### ⚡ Active Capabilities")
    st.markdown("""
    - 🧠 **Text Analysis** — Research, Explain, Debug
    - 🌐 **Web Reading** — Paste any URL
    - 📋 **Copy Output** — One-click clipboard
    - 🔀 **Smart Routing** — Auto-selects best agent
    """)
    
    st.divider()
    
    # --- Coming Soon ---
    st.markdown("#### 🔮 Coming Soon")
    st.markdown("""
    - 👁️ Computer Vision
    - 🔊 Audio Responses
    - 🎬 Video Generation
    - 🔌 Platform Connections
    """)
    
    st.divider()
    
    # --- Session Controls ---
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🗑️ Clear", use_container_width=True):
            st.session_state.history = []
            st.rerun()
    with col2:
        if st.button("🔄 Reboot", use_container_width=True):
            st.session_state.pipeline = None
            st.session_state.active_key = None
            st.rerun()
    
    # --- Stats ---
    if st.session_state.history:
        st.divider()
        st.markdown("#### 📊 Session Stats")
        total = len(st.session_state.history)
        successful = sum(1 for h in st.session_state.history if h.get("success"))
        
        stat1, stat2 = st.columns(2)
        stat1.metric("Queries", total)
        stat2.metric("Success", f"{(successful/total*100):.0f}%")


# ==========================================
# MAIN INTERFACE
# ==========================================

st.markdown("""
<div class="sage-header">
    <h1>🧠 SAGE</h1>
    <p>Systemic Agentic General Engine — Think. Classify. Execute.</p>
</div>
""", unsafe_allow_html=True)

st.divider()

# --- Gate Check ---
if not st.session_state.pipeline:
    st.info("👈 Please configure your API key in the sidebar to start.")
    
    # Quick start guide
    with st.expander("🚀 Quick Start Guide"):
        st.markdown("""
        1. Get a free API key at [console.groq.com](https://console.groq.com)
        2. Paste it in the sidebar under **"Use Your Own Key"**
        3. Start asking SAGE anything!
        
        **Try these examples:**
        - `"Explain how DNS works"`
        - `"Debug this Python error: ModuleNotFoundError"`
        - `"Analyze https://example.com"`
        - `"Write a short poem about coding"`
        """)
    st.stop()

# --- Chat History ---
chat_container = st.container()

with chat_container:
    for idx, exchange in enumerate(st.session_state.history):
        # User message
        st.chat_message("user").write(exchange["user"])
        
        # SAGE response
        with st.chat_message("assistant", avatar="🧠"):
            if exchange.get("success"):
                intent_data = exchange.get("intent_data", {})
                
                # Intent metadata tags
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
            
            # Response content
            st.markdown(exchange["response"])
            
            # COPY BUTTON (using st.code for built-in copy)
            if exchange.get("success"):
                with st.expander("📋 Copy Raw Response"):
                    st.code(exchange["response"], language=None)


# --- Input Area ---
prompt = st.chat_input("Ask SAGE anything... (paste URLs to analyze web pages)")

if prompt:
    st.chat_message("user").write(prompt)
    
    with st.chat_message("assistant", avatar="🧠"):
        with st.spinner("⚡ Processing through SAGE Pipeline..."):
            
            result = st.session_state.pipeline.process(prompt)
            
            if result["success"]:
                intent = result["intent"]
                
                intent_data = {
                    "task_type": intent.task_type.name,
                    "domain": intent.target_domain,
                    "agent": result["agent"],
                    "confidence": f"{intent.confidence_score:.0%}",
                    "status": intent.status.name
                }
                
                # Display tags
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
                
                # Display response
                st.markdown(result["response"])
                
                # Copy button
                with st.expander("📋 Copy Raw Response"):
                    st.code(result["response"], language=None)
                
                # Save to history
                st.session_state.history.append({
                    "user": prompt,
                    "response": result["response"],
                    "intent_data": intent_data,
                    "success": True
                })
            else:
                error_msg = f"⚠️ {result['response']}"
                st.error(error_msg)
                st.session_state.history.append({
                    "user": prompt,
                    "response": error_msg,
                    "success": False
                })
    
    st.rerun()