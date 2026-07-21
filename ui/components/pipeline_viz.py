"""
ui/components/pipeline_viz.py
OWNS: Live execution timeline with st.status()
EXPOSES: render_pipeline_viz(), render_pipeline_inline()
FORBIDDEN: Business logic
"""
import streamlit as st

STAGES = [
    ("📝", "Normalize", "normalize"),
    ("🧠", "Classify", "classify"),
    ("🔍", "Validate", "validate"),
    ("🔀", "Route", "route"),
    ("⚡", "Execute", "execute"),
]

def render_pipeline_viz(stages_result=None, active_stage=None):
    """
    stages_result: list of tuples (stage_name, success_bool, detail)
    active_stage: current stage key
    """
    # Build html timeline
    html = '<div class="sage-pipeline">'
    executed = {}
    if stages_result:
        for name, ok, detail in stages_result:
            executed[name] = ok

    for idx, (icon, label, key) in enumerate(STAGES):
        status = "todo"
        if executed:
            if key in executed:
                status = "done" if executed[key] else "error"
        elif active_stage == key:
            status = "active"
        elif active_stage and STAGES.index((icon,label,key)) < [s[2] for s in STAGES].index(active_stage):
            status = "done"

        dot_class = "sage-pipeline-dot"
        label_class = "sage-pipeline-label"
        if status == "active":
            dot_class += " active"
            label_class += " active"
        elif status == "done":
            dot_class += " done"
            label_class += " done"

        display_icon = icon
        if status == "done":
            display_icon = "✓"

        html += f'''
        <div class="sage-pipeline-step">
            <div class="{dot_class}">{display_icon}</div>
            <div class="{label_class}">{label}</div>
        </div>
        '''
        if idx < len(STAGES)-1:
            line_class = "sage-pipeline-line done" if status == "done" else "sage-pipeline-line"
            html += f'<div class="{line_class}"></div>'

    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)

def render_pipeline_status_block(stages_result=None):
    """
    Renders using st.status for live view during processing (used in composer)
    """
    if not stages_result:
        return

    # Map to user friendly
    with st.status("🧬 SAGE Pipeline Executing...", expanded=False) as status:
        for stage, ok, detail in stages_result:
            icon = "✅" if ok else "❌"
            st.write(f"{icon} **{stage.capitalize()}**: {detail}")
        status.update(label="✅ Pipeline Complete", state="complete")
