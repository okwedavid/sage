"""
OWNS: Live visualization of pipeline execution stages.
EXPOSES: execute_with_viz()
FORBIDDEN: Must never own pipeline logic — only visualize it.
"""

import streamlit as st
from core.intent.enums import Status


def execute_with_viz(pipeline, user_input: str, attachments: dict = None) -> dict:
    """
    Wraps pipeline.process() with a live visual timeline.
    Uses Streamlit's st.status() for animated stage tracking.
    
    Returns:
        The standard pipeline result dict.
    """
    
    if attachments is None:
        attachments = {}
    
    with st.status("⚡ SAGE Pipeline Executing...", expanded=True) as status:
        
        st.write("📝 **Stage 1/5** — Normalizing input...")
        st.write("🧠 **Stage 2/5** — Classifying intent...")
        st.write("🔍 **Stage 3/5** — Validating classification...")
        st.write("🔀 **Stage 4/5** — Routing to agent...")
        st.write("⚡ **Stage 5/5** — Executing via agent...")
        
        # Run the actual pipeline
        result = pipeline.process(user_input, attachments)
        
        if result["success"]:
            intent = result["intent"]
            status.update(
                label=f"✅ Complete — {intent.task_type.name} → {result['agent']}", 
                state="complete", 
                expanded=False
            )
        else:
            status.update(
                label="❌ Pipeline Failed", 
                state="error", 
                expanded=True
            )
    
    return result