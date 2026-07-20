import streamlit as st
import sys
import os

# Ensure project root is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# --- SAGE Core Imports ---
from config.settings import Settings
from core.intent.pipeline import IntentPipeline
from core.intent.enums import TaskType, Status
from agents.registry import AgentRegistry
from agents.general_worker import GeneralWorker

# ==========================================
# PAGE CONFIGURATION
# ==========================================
st.set_page_config(
    page_title=f"{Settings.APP_NAME} | {Settings.APP_TAGLINE}",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ==========================================
# CUSTOM STYLING
# ==========================================
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
    
    /* Global Font */
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }
    
    /* Header Styling */
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
        margin-top: 0.2rem;
    }
    
    /* Pipeline Stage Cards */
    .stage-card {
        background: #1E1E2E;
        border-radius: 8px;
        padding: 0.8rem 1rem;
        margin: 0.3rem 0;
        border-left: 3px solid #444;
        font-size: 0.85rem;
    }
    .stage-active {
        border-left-color: #667eea;
        background: #262640;
    }
    .stage-complete {
        border-left-color: #4CAF50;
    }
    .stage-failed {
        border-left-color: #f44336;
    }
    
    /* Metadata Tags */
    .intent-tag {
        display: inline-block;
        background: #333;
        color: #fff;
        padding: 0.2rem 0.6rem;
        border-radius: 12px;
        font-size: 0.75rem;
        margin-right: 0.4rem;
        margin-bottom: 0.3rem;
    }
    .tag-type { background: #667eea; }
    .tag-domain { background: #764ba2; }
    .tag-agent { background: #e91e63; }
    .tag-status { background: #4CAF50; }
    .tag-confidence { background: #ff9800; }
</style>
""", unsafe_allow_html=True)


# ==========================================
# SYSTEM BOOT (Runs Once Per Session)
# ==========================================
@st.cache_resource
def boot_sage(api_key: str):
    """
    Initializes the SAGE Pipeline.
    @st.cache_resource ensures this only runs ONCE,
    not on every Streamlit re-render.
    """
    registry = AgentRegistry()
    
    # Register available workers
    general = GeneralWorker(api_key=api_key)
    registry.register_worker("GeneralWorker", general)
    
    # Build pipeline
    pipeline = IntentPipeline(api_key=api_key, registry=registry)
    
    return pipeline


# ==========================================
# SESSION STATE INITIALIZATION
# ==========================================
if "history" not in st.session_state:
    st.session_state.history = []

if "system_ready" not in st.session_state:
    st.session_state.system_ready = False


# ==========================================
# SIDEBAR
# ==========================================
with st.sidebar:
    st.image("https://em-content.zobj.net/source/apple/391/brain_1f9e0.png", width=80)
    st.markdown(f"### {Settings.APP_NAME} v{Settings.APP_VERSION}")
    st.caption(Settings.APP_TAGLINE)
    
    st.divider()
    
    # --- System Status ---
    st.markdown("#### 🖥️ System Status")
    
    if Settings.validate():
        st.success(f"🔑 Key: `{Settings.get_masked_key()}`")
        st.session_state.system_ready = True
    else:
        st.error("🔑 No API Key Found in `.env`")
        st.caption("Create a `.env` file with your `GROQ_API_KEY`")
        
        # --- OPTIONAL: Power User Override ---
        st.divider()
        st.markdown("#### 🔧 Manual Override")
        manual_key = st.text_input("Use your own API Key", type="password")
        if manual_key:
            Settings.GROQ_API_KEY = manual_key
            st.session_state.system_ready = True
            st.success("✅ Manual key accepted")
    
    st.divider()
    
    # --- Model Selection ---
    st.markdown("#### ⚙️ Engine Settings")
    model = st.selectbox(
        "Model Core",
        ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
        index=0
    )
    
    st.divider()
    
    # --- Session Controls ---
    if st.button("🗑️ Clear Chat History", use_container_width=True):
        st.session_state.history = []
        st.rerun()
    
    # --- Stats ---
    if st.session_state.history:
        st.markdown("#### 📊 Session Stats")
        total = len(st.session_state.history)
        successful = sum(1 for h in st.session_state.history if h.get("success"))
        st.metric("Total Queries", total)
        st.metric("Successful", successful)


# ==========================================
# MAIN INTERFACE
# ==========================================

# Header
st.markdown("""
<div class="sage-header">
    <h1>🧠 SAGE</h1>
    <p>Systemic Agentic General Engine — Think. Classify. Execute.</p>
</div>
""", unsafe_allow_html=True)

st.divider()

# --- Gate Check ---
if not st.session_state.system_ready:
    st.warning("⚠️ SAGE is offline. Please configure your API key in the sidebar.")
    st.stop()

# --- Boot Pipeline ---
pipeline = boot_sage(Settings.GROQ_API_KEY)

# --- Chat History Display ---
chat_container = st.container()

with chat_container:
    for exchange in st.session_state.history:
        # User message
        st.chat_message("user").write(exchange["user"])
        
        # SAGE response
        with st.chat_message("assistant", avatar="🧠"):
            # Intent metadata tags
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
            
            # Response text
            st.markdown(exchange["response"])


# --- Input Area ---
prompt = st.chat_input("Ask SAGE anything...")

if prompt:
    # Show user message immediately
    st.chat_message("user").write(prompt)
    
    # Process through pipeline
    with st.chat_message("assistant", avatar="🧠"):
        with st.spinner("Processing through SAGE Pipeline..."):
            
            # Show live pipeline stages
            stage_placeholder = st.empty()
            
            # Execute the full pipeline
            result = pipeline.process(prompt)
            
            if result["success"]:
                intent = result["intent"]
                
                # Build metadata
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