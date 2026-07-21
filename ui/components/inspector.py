"""
OWNS: The right-side Intelligence Panel showing last intent details.
EXPOSES: render_inspector()
FORBIDDEN: Must never modify intent data.
"""

import streamlit as st
from ui.styles.palette import Palette as P


def render_inspector():
    """
    Renders the Intelligence Panel in the right column.
    Shows details of the most recent successful intent.
    """
    
    history = st.session_state.history
    
    # Find most recent successful exchange
    last_success = None
    for entry in reversed(history):
        if entry.get("success") and entry.get("intent_data"):
            last_success = entry
            break
    
    if not last_success:
        st.markdown(
            '<div class="nav-title">🔍 INTENT INSPECTOR</div>', 
            unsafe_allow_html=True
        )
        st.caption("No intents processed yet.")
        return
    
    idata = last_success["intent_data"]
    priority = idata.get("priority", "NORMAL")
    
    st.markdown(
        '<div class="nav-title">🔍 INTENT INSPECTOR</div>', 
        unsafe_allow_html=True
    )
    
    st.markdown(f"""
    <div class="nav-section">
        <div class="status-grid">
            <span class="status-label">Task Type</span>
            <span class="status-value val-type">{idata.get('task_type', 'N/A')}</span>
            <span class="status-label">Domain</span>
            <span class="status-value">{idata.get('domain', 'N/A')}</span>
            <span class="status-label">Priority</span>
            <span class="status-value val-priority-{priority}">▸ {priority}</span>
            <span class="status-label">Output</span>
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