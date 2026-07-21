"""
ui/components/intent_card.py
OWNS: Horizontal metadata table HTML
EXPOSES: render_intent_card()
FORBIDDEN: Execution
"""
import streamlit as st

def render_intent_card(intent_dict):
    if not intent_dict:
        return

    task_type = intent_dict.get("task_type", "REVIEW") or "REVIEW"
    domain = intent_dict.get("target_domain", "General") or "General"
    priority = intent_dict.get("priority", "NORMAL") or "NORMAL"
    output_format = intent_dict.get("output_format", "MARKDOWN") or "MARKDOWN"
    agent = intent_dict.get("suggested_agent", "GeneralWorker") or "GeneralWorker"
    confidence = intent_dict.get("confidence_score", 0.0)
    status = intent_dict.get("status", "COMPLETED") or "COMPLETED"

    # Cap lengths
    domain = str(domain)[:24]
    agent = str(agent)[:18]

    conf_str = f"{confidence:.0%}" if isinstance(confidence, (float,int)) else str(confidence)
    # For display 0.96 -> 96%? but already percent
    if isinstance(confidence, float) and confidence <= 1.0:
        conf_str = f"{confidence:.2f}"

    html = f"""
    <div class="sage-intent-card">
        <div class="sage-intent-header">✓ Intent Recognized</div>
        <div class="sage-intent-grid">
            <div class="sage-intent-field">
                <div class="sage-intent-label">Task Type</div>
                <div class="sage-intent-value task">{task_type}</div>
            </div>
            <div class="sage-intent-field">
                <div class="sage-intent-label">Domain</div>
                <div class="sage-intent-value domain">{domain}</div>
            </div>
            <div class="sage-intent-field">
                <div class="sage-intent-label">Priority</div>
                <div class="sage-intent-value priority">⚡ {priority}</div>
            </div>
            <div class="sage-intent-field">
                <div class="sage-intent-label">Output</div>
                <div class="sage-intent-value">{output_format}</div>
            </div>
            <div class="sage-intent-field">
                <div class="sage-intent-label">Agent</div>
                <div class="sage-intent-value agent">{agent}</div>
            </div>
            <div class="sage-intent-field">
                <div class="sage-intent-label">Confidence</div>
                <div class="sage-intent-value conf">{conf_str}</div>
            </div>
        </div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)
