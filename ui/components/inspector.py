"""
ui/components/inspector.py
OWNS: Right-panel intelligence display
EXPOSES: render_inspector()
FORBIDDEN: Pipeline execution
"""
import streamlit as st
from ui.state import get_stats

def render_inspector():
    # Tools Panel
    st.markdown("""
    <div class="sage-panel-section">
        <div class="sage-panel-title">TOOLS</div>
        <div class="sage-tools-grid">
    """, unsafe_allow_html=True)

    tools = [
        ("🌐", "Web Search", "Search the internet", "#58a6ff"),
        ("🖼️", "Image Analysis", "Analyze uploaded images", "#a78bfa"),
        ("🎨", "Image Generation", "Generate images with AI", "#f093fb"),
        ("🎤", "Voice Input", "Speak your query", "#3fb950"),
        ("🔊", "Text to Speech", "Listen to responses", "#f0883e"),
    ]
    for icon, name, desc, color in tools:
        st.markdown(f"""
        <div class="sage-tool-item">
            <div class="sage-tool-icon" style="background: {color}15; border-color: {color}30; color: {color};">{icon}</div>
            <div class="sage-tool-info">
                <div class="sage-tool-name">{name}</div>
                <div class="sage-tool-desc">{desc}</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("</div></div>", unsafe_allow_html=True)

    # Session Stats
    stats = get_stats()
    st.markdown(f"""
    <div class="sage-panel-section" style="margin-top:16px;">
        <div class="sage-panel-title">SESSION STATS</div>
        <div>
            <div class="sage-session-row"><span class="sage-session-label">Total Queries</span><span class="sage-session-value">{stats['total']}</span></div>
            <div class="sage-session-row"><span class="sage-session-label">Successful</span><span class="sage-session-value">{stats['successful']}</span></div>
            <div class="sage-session-row"><span class="sage-session-label">Success Rate</span><span class="sage-session-value green">{stats['rate']:.1f}%</span></div>
            <div class="sage-session-row"><span class="sage-session-label">Avg. Response Time</span><span class="sage-session-value green">{stats['avg_time']}s</span></div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Current Intent Inspector (if any)
    current = st.session_state.get("current_intent")
    if current:
        intent_dict = current.to_dict() if hasattr(current, "to_dict") else current
        st.markdown(f"""
        <div class="sage-panel-section" style="margin-top:16px;">
            <div class="sage-panel-title">INTENT INSPECTOR</div>
            <div>
                <div class="sage-inspector-row"><span class="sage-inspector-label">Task Type</span><span class="sage-inspector-value" style="color:#58a6ff;">{intent_dict.get('task_type','-')}</span></div>
                <div class="sage-inspector-row"><span class="sage-inspector-label">Domain</span><span class="sage-inspector-value">{intent_dict.get('target_domain','-')}</span></div>
                <div class="sage-inspector-row"><span class="sage-inspector-label">Priority</span><span class="sage-inspector-value" style="color:#e3b341;">{intent_dict.get('priority','-')}</span></div>
                <div class="sage-inspector-row"><span class="sage-inspector-label">Output Format</span><span class="sage-inspector-value">{intent_dict.get('output_format','-')}</span></div>
                <div class="sage-inspector-row"><span class="sage-inspector-label">Agent</span><span class="sage-inspector-value" style="color:#a78bfa;">{intent_dict.get('suggested_agent','-')}</span></div>
                <div class="sage-inspector-row"><span class="sage-inspector-label">Confidence</span><span class="sage-inspector-value" style="color:#3fb950;">{intent_dict.get('confidence_score',0):.2f}</span></div>
                <div class="sage-inspector-row"><span class="sage-inspector-label">Status</span><span class="sage-inspector-value" style="color:#3fb950;">{intent_dict.get('status','-')} ✅</span></div>
            </div>
        </div>
        """, unsafe_allow_html=True)
    else:
        # Placeholder inspector with example from target image
        st.markdown(f"""
        <div class="sage-panel-section" style="margin-top:16px;">
            <div class="sage-panel-title">INTENT INSPECTOR</div>
            <div style="text-align:center; padding:20px 0; color:#71717a; font-size:11px;">
                No active intent<br/>Send a message to see inspector
            </div>
        </div>
        """, unsafe_allow_html=True)

    # Attachments panel
    img_name = st.session_state.get("uploaded_image_name")
    if img_name:
        size_kb = "—"
        if st.session_state.get("uploaded_image"):
            try:
                size_kb = f"{len(st.session_state.uploaded_image.getvalue())//1024} KB"
            except:
                size_kb = "attached"
        st.markdown(f"""
        <div class="sage-panel-section" style="margin-top:16px;">
            <div class="sage-panel-title">ATTACHMENTS (1)</div>
            <div style="display:flex; gap:10px; align-items:center; background:#1c1e2e; border:1px solid #1e2130; border-radius:8px; padding:8px;">
                <div style="width:36px; height:36px; background:#252836; border-radius:6px; display:flex; align-items:center; justify-content:center;">📎</div>
                <div style="flex:1; line-height:1.2;">
                    <div style="font-size:11px; color:#e4e4e7; font-weight:500;">{img_name}</div>
                    <div style="font-size:10px; color:#71717a;">{size_kb}</div>
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)

    # Audio Output placeholder
    if st.session_state.get("tts_enabled"):
        st.markdown(f"""
        <div class="sage-panel-section" style="margin-top:16px;">
            <div class="sage-panel-title">AUDIO OUTPUT</div>
            <div class="sage-wave" style="justify-content:center; padding:10px 0;">
                <div class="sage-wave-bar" style="animation-delay:0s; height:12px;"></div>
                <div class="sage-wave-bar" style="animation-delay:0.1s; height:20px;"></div>
                <div class="sage-wave-bar" style="animation-delay:0.2s; height:16px;"></div>
                <div class="sage-wave-bar" style="animation-delay:0.3s; height:24px;"></div>
                <div class="sage-wave-bar" style="animation-delay:0.4s; height:14px;"></div>
                <div class="sage-wave-bar" style="animation-delay:0.5s; height:22px;"></div>
                <div class="sage-wave-bar" style="animation-delay:0.6s; height:10px;"></div>
                <div class="sage-wave-bar" style="animation-delay:0.7s; height:18px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#71717a; margin-top:8px;">
                <span>⏮️ ⏸️ ⏭️</span>
                <span>00:18</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

    # Footer branding
    st.markdown("""
    <div style="margin-top:16px; background: linear-gradient(135deg, rgba(102,126,234,0.08) 0%, rgba(118,75,162,0.08) 100%); border:1px solid #1e2130; border-radius:12px; padding:14px; text-align:center;">
        <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:8px;">
            <div style="width:28px; height:28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); border-radius:8px; display:flex; align-items:center; justify-content:center;">🧠</div>
            <span style="font-weight:800; color:#e4e4e7; font-size:13px;">SAGE v5.0</span>
        </div>
        <div style="font-size:10px; color:#a1a1aa; line-height:1.4;">Systemic Agentic<br/>General Engine</div>
        <div style="margin-top:10px; font-size:10px; color:#71717a; font-style:italic;">Think. Understand.<br/>Act. Evolve.</div>
    </div>
    """, unsafe_allow_html=True)
