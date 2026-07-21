"""
ui/layouts/workspace.py
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
    # Top header matching target image
    st.markdown("""
    <div class="sage-header">
        <div style="display:flex; align-items:center; gap:12px;">
            <div style="font-size:22px; font-weight:800; letter-spacing:-0.02em; background: linear-gradient(135deg, #a78bfa 0%, #f093fb 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">SAGE</div>
            <div style="font-size:11px; color:#71717a; margin-top:2px;">Systemic Agentic General Engine</div>
        </div>
        <div class="sage-header-right">
            <div class="sage-pill">
                <span class="sage-dot"></span>
                Engine Online • llama-3.3-70b-versatile
            </div>
            <div class="sage-pill" style="width:32px; height:32px; justify-content:center; padding:0; border-radius:50%;">🔔</div>
            <div style="width:32px; height:32px; background: linear-gradient(135deg, #667eea 0%, #f093fb 100%); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:14px;">g</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Live pipeline viz if processing or last intent has stages
    # Show placeholder timeline when active
    # Use 3 columns: left nav 22%, center 50%, right 28%
    left, center, right = st.columns([1.15, 2.8, 1.4], gap="small")

    with left:
        # Conversations panel + sidebar
        st.markdown("""
        <div class="sage-panel-section" style="background:#0f0f17;">
            <div class="sage-panel-title">CONVERSATIONS</div>
            <div style="position:relative; margin-bottom:12px;">
                <input type="text" placeholder="Search conversations..." style="width:100%; background:#1c1e2e; border:1px solid #1e2130; border-radius:8px; padding:8px 12px 8px 30px; color:#a1a1aa; font-size:11px; outline:none;" disabled>
                <span style="position:absolute; left:10px; top:9px; font-size:11px; color:#71717a;">🔍</span>
            </div>
        """, unsafe_allow_html=True)

        # Conversation list from session_state
        convos = st.session_state.get("conversations", [])
        today_shown = False
        yesterday_shown = False
        for conv in convos:
            if conv.get("today") and not today_shown:
                st.markdown('<div style="font-size:10px; color:#71717a; font-weight:700; margin:12px 0 6px 0; letter-spacing:0.06em;">TODAY</div>', unsafe_allow_html=True)
                today_shown = True
            if not conv.get("today") and not yesterday_shown and conv.get("time", "") in ["9:10 PM", "4:22 PM"]:
                st.markdown('<div style="font-size:10px; color:#71717a; font-weight:700; margin:16px 0 6px 0; letter-spacing:0.06em;">YESTERDAY</div>', unsafe_allow_html=True)
                yesterday_shown = True

            active_class = " active" if conv["title"] == "Analyze this architecture diagram" else ""
            st.markdown(f"""
            <div class="sage-conv-item{active_class}">
                <div class="sage-conv-title">{conv['title']}</div>
                <div style="display:flex; justify-content:space-between;"><span></span><span class="sage-conv-time">{conv['time']}</span></div>
            </div>
            """, unsafe_allow_html=True)

        # Older section mock
        st.markdown("""
            <div style="font-size:10px; color:#71717a; font-weight:700; margin:16px 0 6px 0; letter-spacing:0.06em;">OLDER</div>
            <div class="sage-conv-item"><div class="sage-conv-title">Linux command cheatsheet</div><div class="sage-conv-time" style="text-align:right;">2d ago</div></div>
            <div class="sage-conv-item"><div class="sage-conv-title">System design: URL shortener</div><div class="sage-conv-time" style="text-align:right;">3d ago</div></div>
            <div class="sage-conv-item"><div class="sage-conv-title">How APIs work?</div><div class="sage-conv-time" style="text-align:right;">3d ago</div></div>
            </div>
        """, unsafe_allow_html=True)

        # Render full sidebar (contains API config etc) below conversations
        st.markdown("<div style='height:16px;'></div>", unsafe_allow_html=True)
        render_sidebar()

    with center:
        # Cognitive Workspace Title + Pipeline Viz
        current_intent = st.session_state.get("current_intent")
        
        # Show pipeline viz if we have active intent or processing
        if st.session_state.get("processing"):
            render_pipeline_viz(active_stage="execute")
        elif current_intent and hasattr(current_intent, 'status'):
            # Show completed pipeline
            render_pipeline_viz(stages_result=[
                ("normalize", True, "cleaned"),
                ("classify", True, f"{current_intent.task_type.name if current_intent.task_type else 'REVIEW'}"),
                ("validate", True, current_intent.status.name),
                ("route", True, current_intent.suggested_agent),
                ("execute", True, "done")
            ])

        # Chat panel (main workspace)
        render_chat_panel()

        # Composer at bottom
        render_composer()

        st.markdown("""
        <div style="text-align:center; margin-top:24px; font-size:10px; color:#3a3d5a;">
            See. Listen. Think. Respond. — SAGE Cognitive OS
        </div>
        """, unsafe_allow_html=True)

    with right:
        render_inspector()
