"""
ui/layouts/workspace.py — V2 EFFICIENT INDEPENDENT SCROLL
OWNS: Main 3-column layout composition
EXPOSES: render_workspace()
FORBIDDEN: Direct pipeline calls
"""
import streamlit as st
from ui.components.sidebar import render_sidebar
from ui.components.chat_panel import render_chat_panel
from ui.components.inspector import render_inspector
from ui.components.composer import render_composer
from ui.components.pipeline_viz import render_pipeline_viz

def render_workspace():
    # Header - sticky, premium SVG
    st.markdown("""
    <div class="sage-header">
        <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:32px; height:32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 60%, #f093fb 100%); border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(102,126,234,0.3);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M9 2a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h1v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-2h1a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3Z"/><circle cx="9" cy="9" r="0.8" fill="white"/><circle cx="12" cy="8" r="0.8" fill="white"/><circle cx="15" cy="9" r="0.8" fill="white"/></svg>
            </div>
            <div>
                <div style="font-family:'Space Grotesk', sans-serif; font-size:20px; font-weight:700; letter-spacing:-0.03em; background: linear-gradient(135deg, #a78bfa 0%, #f093fb 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">SAGE</div>
                <div style="font-size:10px; color:#71717a; letter-spacing:0.08em; text-transform:uppercase; margin-top:-4px;">Systemic Agentic General Engine</div>
            </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="display:flex; align-items:center; gap:6px; padding:0 12px; height:28px; border-radius:20px; background:#1c1e2e; border:1px solid #1e2130; font-size:11px; color:#a1a1aa;">
                <span style="width:7px; height:7px; background:#3fb950; border-radius:50%; box-shadow:0 0 8px #3fb950; animation: pulse 2s infinite; display:inline-block;"></span>
                Engine Online • llama-3.3-70b-versatile
            </div>
            <div style="width:32px; height:32px; border-radius:50%; background: linear-gradient(135deg, #667eea 0%, #f093fb 100%); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:13px;">g</div>
        </div>
    </div>
    <style>@keyframes pulse {0%,100%{opacity:1}50%{opacity:0.5}}</style>
    """, unsafe_allow_html=True)

    # 3 columns with independent scroll (CSS handles)
    left, center, right = st.columns([1.15, 2.8, 1.4], gap="small")

    with left:
        # Conversations search header
        st.markdown("""
        <div style="padding:12px 12px 8px 12px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <span style="font-size:10px; font-weight:700; letter-spacing:0.12em; color:#71717a; text-transform:uppercase;">Conversations</span>
                <span style="font-size:10px; color:#3a3d5a;">⌘K</span>
            </div>
            <div style="position:relative;">
                <svg style="position:absolute; left:10px; top:50%; transform:translateY(-50%); width:14px; height:14px; stroke:#71717a;" viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="11" cy="11" r="6"/><path d="m21 21-3.5-3.5"/></svg>
                <input type="text" placeholder="Search conversations..." style="width:100%; height:32px; padding:0 12px 0 30px; border-radius:8px; background:#1c1e2e; border:1px solid #1e2130; color:#a1a1aa; font-size:11px; outline:none;" disabled>
            </div>
        </div>
        """, unsafe_allow_html=True)

        convos = st.session_state.get("conversations", [])
        # Render conversations efficiently - no heavy HTML
        for conv in convos[:3]:
            active = "active" if conv["title"] == "Analyze this architecture diagram" else ""
            st.markdown(f'<div class="sage-conv-item {active}"><div class="sage-conv-title">{conv["title"]}</div><div style="display:flex; justify-content:space-between; margin-top:4px;"><span style="font-size:10px; color:#3fb950;">● VisionWorker</span><span class="sage-conv-time">{conv["time"]}</span></div></div>', unsafe_allow_html=True)
        
        st.markdown("""
        <div style="padding:0 12px;">
            <div style="font-size:10px; color:#71717a; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; margin:16px 0 6px 0;">Yesterday</div>
            <div class="sage-conv-item"><div class="sage-conv-title">Study notes on AI agents</div><div class="sage-conv-time" style="text-align:right;">9:10 PM</div></div>
            <div class="sage-conv-item"><div class="sage-conv-title">Database normalization</div><div class="sage-conv-time" style="text-align:right;">4:22 PM</div></div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)
        render_sidebar()

    with center:
        # Pipeline viz sticky
        current_intent = st.session_state.get("current_intent")
        if st.session_state.get("processing"):
            render_pipeline_viz(active_stage="execute")
        elif current_intent and hasattr(current_intent, 'status'):
            render_pipeline_viz(stages_result=[
                ("normalize", True, "cleaned"),
                ("classify", True, f"{current_intent.task_type.name if current_intent.task_type else 'REVIEW'}"),
                ("validate", True, current_intent.status.name),
                ("route", True, current_intent.suggested_agent),
                ("execute", True, "done")
            ])

        # Chat scroll area
        render_chat_panel()

        # Composer wrapper for sticky bottom
        st.markdown('<div class="composer-wrapper">', unsafe_allow_html=True)
        render_composer()
        st.markdown('</div>', unsafe_allow_html=True)

    with right:
        render_inspector()
