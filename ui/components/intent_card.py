"""
OWNS: Rendering the horizontal intent metadata table.
EXPOSES: render_intent_table()
FORBIDDEN: Must never modify intent data.
"""

import streamlit as st


def render_intent_table(intent_data: dict):
    """
    Renders a clean horizontal metadata table for a classified intent.
    
    Args:
        intent_data: Dict with keys: task_type, domain, priority, 
                     output_format, agent, confidence, status
    """
    
    task     = intent_data.get("task_type", "N/A")
    domain   = intent_data.get("domain", "N/A")
    priority = intent_data.get("priority", "NORMAL")
    output   = intent_data.get("output_format", "MARKDOWN")
    agent    = intent_data.get("agent", "N/A")
    conf     = intent_data.get("confidence", "N/A")
    status   = intent_data.get("status", "N/A")
    
    html = f"""
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
            <td>{output}</td>
            <td><span class="val-agent">{agent}</span></td>
            <td><span class="val-confidence">{conf}</span></td>
            <td><span class="val-status">{status} ✅</span></td>
        </tr>
    </table>
    """
    
    st.markdown(html, unsafe_allow_html=True)