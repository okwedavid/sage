"""
OWNS: All CSS rules for the SAGE interface.
EXPOSES: inject_css() function.
FORBIDDEN: Must never contain Python logic or Streamlit calls beyond markdown injection.
"""

import streamlit as st
from .palette import Palette as P


def inject_css():
    """Injects the complete SAGE stylesheet into the page."""
    
    st.markdown(f"""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        /* ========== GLOBAL ========== */
        html, body, [class*="css"] {{
            font-family: 'Inter', sans-serif;
        }}
        
        /* ========== HIDE STREAMLIT DEFAULTS ========== */
        #MainMenu {{visibility: hidden;}}
        footer {{visibility: hidden;}}
        header {{visibility: hidden;}}
        
        /* ========== HERO HEADER ========== */
        .sage-hero {{
            text-align: center;
            padding: 0.3rem 0 0.8rem 0;
        }}
        .sage-hero h1 {{
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: {P.GRADIENT};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0;
        }}
        .sage-hero .subtitle {{
            color: {P.TEXT_SECONDARY};
            font-size: 0.8rem;
            font-weight: 400;
            margin-top: 0.1rem;
        }}
        
        /* ========== INTENT METADATA TABLE ========== */
        .intent-table {{
            width: 100%;
            border-collapse: collapse;
            margin: 0.4rem 0;
            font-size: 0.72rem;
            background: {P.BG_SECONDARY};
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid {P.BORDER_DEFAULT};
        }}
        .intent-table th {{
            background: {P.BG_TERTIARY};
            color: {P.TEXT_SECONDARY};
            padding: 0.35rem 0.6rem;
            text-align: left;
            font-weight: 500;
            text-transform: uppercase;
            font-size: 0.6rem;
            letter-spacing: 0.5px;
            border-bottom: 1px solid {P.BORDER_DEFAULT};
        }}
        .intent-table td {{
            padding: 0.35rem 0.6rem;
            color: {P.TEXT_PRIMARY};
            font-weight: 600;
            border-bottom: 1px solid {P.BORDER_DEFAULT};
        }}
        .val-type {{ color: {P.INTENT_TYPE}; }}
        .val-domain {{ color: {P.INTENT_DOMAIN}; }}
        .val-agent {{ color: {P.INTENT_AGENT}; }}
        .val-confidence {{ color: {P.INTENT_CONFIDENCE}; }}
        .val-status {{ color: {P.INTENT_STATUS}; }}
        .val-priority-LOW {{ color: {P.PRIORITY["LOW"]}; }}
        .val-priority-NORMAL {{ color: {P.PRIORITY["NORMAL"]}; }}
        .val-priority-HIGH {{ color: {P.PRIORITY["HIGH"]}; }}
        .val-priority-CRITICAL {{ color: {P.PRIORITY["CRITICAL"]}; font-weight: 800; }}
        
        /* ========== NAVIGATION SECTIONS ========== */
        .nav-section {{
            background: {P.BG_TERTIARY};
            border-radius: 8px;
            padding: 0.7rem;
            margin-bottom: 0.6rem;
            border: 1px solid {P.BORDER_DEFAULT};
        }}
        .nav-title {{
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: {P.TEXT_SECONDARY};
            margin-bottom: 0.4rem;
            font-weight: 600;
        }}
        
        /* ========== STATUS GRID ========== */
        .status-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.25rem;
            font-size: 0.73rem;
        }}
        .status-label {{ color: {P.TEXT_SECONDARY}; }}
        .status-value {{ 
            color: {P.TEXT_PRIMARY}; 
            font-weight: 600; 
            text-align: right; 
        }}
        .status-online {{ color: {P.SUCCESS}; }}
        .status-offline {{ color: {P.ERROR}; }}
        
        /* ========== TOOL CARDS ========== */
        .tool-item {{
            background: {P.BG_TERTIARY};
            border: 1px solid {P.BORDER_DEFAULT};
            border-radius: 8px;
            padding: 0.45rem 0.65rem;
            margin-bottom: 0.35rem;
            transition: border-color 0.2s;
        }}
        .tool-item:hover {{
            border-color: {P.BORDER_HOVER};
        }}
        .tool-name {{ 
            color: {P.TEXT_PRIMARY}; 
            font-weight: 600; 
            font-size: 0.75rem; 
        }}
        .tool-desc {{ 
            color: {P.TEXT_SECONDARY}; 
            font-size: 0.62rem; 
        }}
        
        /* ========== USER PROFILE ========== */
        .user-profile {{
            background: {P.BG_TERTIARY};
            border-radius: 8px;
            padding: 0.55rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            border: 1px solid {P.BORDER_DEFAULT};
        }}
        .user-avatar {{
            width: 30px; height: 30px;
            border-radius: 50%;
            background: {P.GRADIENT};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            color: white;
            font-weight: 700;
        }}
        .user-name {{ 
            color: {P.TEXT_PRIMARY}; 
            font-weight: 600; 
            font-size: 0.8rem; 
        }}
        .user-role {{ 
            color: {P.TEXT_SECONDARY}; 
            font-size: 0.6rem; 
        }}
        .pro-badge {{
            background: {P.GRADIENT};
            color: white;
            padding: 0.08rem 0.35rem;
            border-radius: 4px;
            font-size: 0.5rem;
            font-weight: 700;
            letter-spacing: 0.5px;
        }}
        
        /* ========== WELCOME CARD ========== */
        .welcome-card {{
            text-align: center;
            padding: 2.5rem 1rem;
        }}
        .welcome-card h3 {{
            color: {P.TEXT_PRIMARY};
            font-weight: 700;
            margin-bottom: 0.3rem;
        }}
        .welcome-card p {{
            color: {P.TEXT_SECONDARY};
            font-size: 0.85rem;
        }}
        
        /* ========== PIPELINE STAGE ========== */
        .pipeline-stage {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.3rem 0;
            font-size: 0.75rem;
        }}
        .stage-dot {{
            width: 8px; height: 8px;
            border-radius: 50%;
            background: {P.TEXT_MUTED};
        }}
        .stage-dot.active {{ background: {P.PRIMARY}; }}
        .stage-dot.complete {{ background: {P.SUCCESS}; }}
        .stage-dot.failed {{ background: {P.ERROR}; }}
        .stage-label {{ color: {P.TEXT_SECONDARY}; }}
        .stage-label.active {{ color: {P.TEXT_PRIMARY}; font-weight: 600; }}
        
        /* ========== RESPONSIVE GAP ========== */
        [data-testid="stHorizontalBlock"] {{
            gap: 0.6rem;
        }}
    </style>
    """, unsafe_allow_html=True)