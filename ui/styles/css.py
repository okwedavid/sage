"""
ui/styles/css.py
OWNS: Complete CSS stylesheet injection
EXPOSES: inject_css()
FORBIDDEN: Python logic beyond styling
"""
import streamlit as st
from .palette import *

def inject_css():
    css = f"""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

    /* GLOBAL RESET */
    html, body, [class*="css"] {{
        font-family: 'Inter', sans-serif !important;
    }}

    .stApp {{
        background: {BG_PRIMARY} !important;
        background-image: 
            radial-gradient(ellipse at top left, rgba(102,126,234,0.12) 0%, transparent 60%),
            radial-gradient(ellipse at bottom right, rgba(118,75,162,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at center, rgba(240,147,251,0.04) 0%, transparent 70%) !important;
    }}

    /* Hide default Streamlit chrome */
    #MainMenu {{visibility: hidden;}}
    footer {{visibility: hidden;}}
    header {{visibility: hidden;}}
    .stDeployButton {{display: none;}}
    [data-testid="stStatusWidget"] {{display: none;}}

    /* Scrollbar */
    ::-webkit-scrollbar {{
        width: 6px;
        height: 6px;
    }}
    ::-webkit-scrollbar-track {{
        background: {BG_PRIMARY};
    }}
    ::-webkit-scrollbar-thumb {{
        background: {BORDER_MEDIUM};
        border-radius: 3px;
    }}
    ::-webkit-scrollbar-thumb:hover {{
        background: {BORDER_ACCENT};
    }}

    /* MAIN CONTAINER - Mission Control Frame */
    .sage-outer {{
        border: 1px solid transparent;
        background: linear-gradient({BG_PRIMARY}, {BG_PRIMARY}) padding-box,
                    {GRADIENT_BORDER} border-box;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 
            0 0 0 1px rgba(102,126,234,0.1),
            0 20px 60px -20px rgba(102,126,234,0.3),
            0 0 100px -30px rgba(118,75,162,0.2);
        margin: 8px;
    }}

    /* HEADER */
    .sage-header {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 20px;
        background: linear-gradient(90deg, {BG_SECONDARY} 0%, {BG_TERTIARY} 100%);
        border-bottom: 1px solid {BORDER_SUBTLE};
    }}
    .sage-logo {{
        display: flex;
        align-items: center;
        gap: 12px;
    }}
    .sage-logo-icon {{
        width: 36px;
        height: 36px;
        background: {GRADIENT_PRIMARY};
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 4px 12px rgba(102,126,234,0.3);
    }}
    .sage-logo-text {{
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.02em;
        background: {GRADIENT_TEXT};
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }}
    .sage-logo-sub {{
        font-size: 11px;
        color: {TEXT_MUTED};
        letter-spacing: 0.05em;
        margin-top: -4px;
    }}
    .sage-header-right {{
        display: flex;
        gap: 12px;
        align-items: center;
    }}
    .sage-pill {{
        background: {BG_INPUT};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 20px;
        padding: 6px 14px;
        font-size: 11px;
        color: {TEXT_SECONDARY};
        display: flex;
        align-items: center;
        gap: 6px;
    }}
    .sage-dot {{
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: {SUCCESS};
        box-shadow: 0 0 8px {SUCCESS};
        animation: pulse 2s infinite;
    }}
    @keyframes pulse {{
        0%, 100% {{opacity: 1;}}
        50% {{opacity: 0.5;}}
    }}

    /* SIDEBAR - Left Nav */
    .sage-sidebar {{
        background: {BG_SECONDARY};
        border-right: 1px solid {BORDER_SUBTLE};
        padding: 16px 12px;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }}
    .sage-nav-button {{
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        color: {TEXT_SECONDARY};
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
        width: 100%;
        text-align: left;
        background: transparent;
    }}
    .sage-nav-button:hover {{
        background: {BG_HOVER};
        color: {TEXT_PRIMARY};
        border-color: {BORDER_SUBTLE};
    }}
    .sage-nav-button.active {{
        background: {GRADIENT_BUTTON};
        color: white;
        box-shadow: 0 4px 12px rgba(102,126,234,0.25);
    }}
    .sage-new-chat {{
        background: {GRADIENT_BUTTON} !important;
        color: white !important;
        border-radius: 10px !important;
        justify-content: space-between !important;
        font-weight: 600 !important;
        box-shadow: 0 4px 16px rgba(102,126,234,0.3) !important;
        margin-bottom: 12px;
    }}
    .sage-system-status {{
        background: {BG_TERTIARY};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 12px;
        padding: 14px;
        margin-top: auto;
    }}
    .sage-status-header {{
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: {TEXT_MUTED};
        text-transform: uppercase;
        margin-bottom: 12px;
    }}
    .sage-status-row {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 11px;
    }}
    .sage-status-label {{
        color: {TEXT_SECONDARY};
    }}
    .sage-status-value {{
        color: {TEXT_PRIMARY};
        font-weight: 500;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
    }}
    .sage-status-value.online {{
        color: {SUCCESS};
    }}
    .sage-profile {{
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        background: {BG_CARD};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 10px;
        margin-top: 12px;
    }}
    .sage-avatar {{
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: {GRADIENT_PRIMARY};
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 14px;
        color: white;
    }}
    .sage-profile-info {{
        flex: 1;
        line-height: 1.2;
    }}
    .sage-profile-name {{
        font-size: 13px;
        font-weight: 600;
        color: {TEXT_PRIMARY};
    }}
    .sage-profile-role {{
        font-size: 10px;
        color: {TEXT_MUTED};
    }}
    .sage-pro-badge {{
        background: {GRADIENT_PRIMARY};
        color: white;
        font-size: 9px;
        font-weight: 700;
        padding: 3px 6px;
        border-radius: 4px;
        letter-spacing: 0.05em;
    }}

    /* CHAT / WORKSPACE CENTER */
    .sage-welcome {{
        padding: 24px 0 16px 0;
    }}
    .sage-welcome-h {{
        font-size: 15px;
        font-weight: 600;
        color: {TEXT_PRIMARY};
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
    }}
    .sage-welcome-sub {{
        font-size: 13px;
        color: {TEXT_SECONDARY};
        margin-left: 28px;
    }}
    .sage-prompt-pill {{
        display: inline-block;
        background: {BG_CARD};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 12px;
        padding: 10px 16px;
        margin: 12px 0;
        font-size: 13px;
        color: {TEXT_SECONDARY};
        max-width: 600px;
    }}

    /* MESSAGE BUBBLES */
    .sage-msg-user {{
        background: {GRADIENT_BUTTON};
        color: white;
        padding: 12px 18px;
        border-radius: 16px 16px 4px 16px;
        font-size: 13px;
        max-width: 75%;
        margin-left: auto;
        margin-bottom: 16px;
        box-shadow: 0 4px 16px rgba(102,126,234,0.2);
        line-height: 1.5;
    }}
    .sage-msg-assistant {{
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
    }}
    .sage-assistant-avatar {{
        width: 32px;
        height: 32px;
        min-width: 32px;
        background: {BG_CARD};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        margin-top: 2px;
    }}
    .sage-assistant-content {{
        flex: 1;
        background: {BG_SURFACE};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 12px;
        overflow: hidden;
    }}

    /* INTENT CARD - Horizontal metadata table */
    .sage-intent-card {{
        background: {BG_TERTIARY};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 10px;
        padding: 14px 16px;
        margin-bottom: 0;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        border-bottom: none;
    }}
    .sage-intent-header {{
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        font-weight: 700;
        color: {SUCCESS};
        letter-spacing: 0.05em;
        text-transform: uppercase;
        margin-bottom: 12px;
    }}
    .sage-intent-grid {{
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 12px;
    }}
    .sage-intent-field {{
        display: flex;
        flex-direction: column;
        gap: 4px;
    }}
    .sage-intent-label {{
        font-size: 9px;
        font-weight: 600;
        color: {TEXT_MUTED};
        text-transform: uppercase;
        letter-spacing: 0.07em;
    }}
    .sage-intent-value {{
        font-size: 11px;
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
        color: {TEXT_PRIMARY};
        padding: 4px 8px;
        background: {BG_CARD};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 6px;
        text-transform: uppercase;
    }}
    .sage-intent-value.task {{
        color: #58a6ff;
        background: rgba(88,166,255,0.1);
        border-color: rgba(88,166,255,0.2);
    }}
    .sage-intent-value.domain {{
        color: {TEXT_PRIMARY};
    }}
    .sage-intent-value.priority {{
        color: #e3b341;
        background: rgba(227,179,65,0.1);
    }}
    .sage-intent-value.agent {{
        color: {TEXT_ACCENT};
    }}
    .sage-intent-value.conf {{
        color: {SUCCESS};
    }}

    /* RESPONSE CARD */
    .sage-response-card {{
        background: {BG_CARD};
        border: 1px solid {BORDER_SUBTLE};
        border-top: 1px solid {BORDER_MEDIUM};
        border-radius: 0 0 12px 12px;
        padding: 0;
        overflow: hidden;
    }}
    .sage-response-header {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: {BG_SURFACE};
        border-bottom: 1px solid {BORDER_SUBTLE};
        font-size: 11px;
        font-weight: 600;
        color: {TEXT_SECONDARY};
    }}
    .sage-response-body {{
        padding: 20px;
        font-size: 13px;
        line-height: 1.7;
        color: {TEXT_PRIMARY};
    }}
    .sage-response-body h1, .sage-response-body h2, .sage-response-body h3 {{
        color: {TEXT_PRIMARY};
        font-weight: 700;
        margin-top: 16px;
        margin-bottom: 8px;
    }}
    .sage-response-body code {{
        background: {BG_INPUT};
        border: 1px solid {BORDER_SUBTLE};
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
    }}
    .sage-response-body pre {{
        background: {BG_PRIMARY} !important;
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 8px;
        padding: 14px !important;
    }}
    .sage-action-bar {{
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        background: {BG_TERTIARY};
        border-top: 1px solid {BORDER_SUBTLE};
    }}
    .sage-action-btn {{
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: {BG_CARD};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 6px;
        color: {TEXT_SECONDARY};
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
    }}
    .sage-action-btn:hover {{
        background: {BG_HOVER};
        color: {TEXT_PRIMARY};
        border-color: {BORDER_MEDIUM};
    }}

    /* RIGHT PANEL - Intelligence */
    .sage-right-panel {{
        display: flex;
        flex-direction: column;
        gap: 16px;
    }}
    .sage-panel-section {{
        background: {BG_SECONDARY};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 12px;
        padding: 16px;
    }}
    .sage-panel-title {{
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: {TEXT_MUTED};
        margin-bottom: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }}
    .sage-tools-grid {{
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
    }}
    .sage-tool-item {{
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: {BG_CARD};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }}
    .sage-tool-item:hover {{
        background: {BG_HOVER};
        border-color: {BORDER_MEDIUM};
        transform: translateY(-1px);
    }}
    .sage-tool-icon {{
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        background: {BG_INPUT};
        border: 1px solid {BORDER_SUBTLE};
    }}
    .sage-tool-info {{
        flex: 1;
        line-height: 1.2;
    }}
    .sage-tool-name {{
        font-size: 12px;
        font-weight: 600;
        color: {TEXT_PRIMARY};
    }}
    .sage-tool-desc {{
        font-size: 10px;
        color: {TEXT_MUTED};
        margin-top: 2px;
    }}
    .sage-session-row {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid {BORDER_SUBTLE};
        font-size: 11px;
    }}
    .sage-session-row:last-child {{
        border-bottom: none;
    }}
    .sage-session-label {{
        color: {TEXT_SECONDARY};
    }}
    .sage-session-value {{
        color: {TEXT_PRIMARY};
        font-family: 'JetBrains Mono', monospace;
        font-weight: 600;
        font-size: 11px;
    }}
    .sage-session-value.green {{
        color: {SUCCESS};
    }}

    /* INSPECTOR */
    .sage-inspector-row {{
        display: flex;
        justify-content: space-between;
        padding: 7px 0;
        font-size: 11px;
        border-bottom: 1px solid rgba(30,33,48,0.6);
    }}
    .sage-inspector-row:last-child {{border-bottom: none;}}
    .sage-inspector-label {{color: {TEXT_SECONDARY}; font-size: 11px;}}
    .sage-inspector-value {{color: {TEXT_PRIMARY}; font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 10px; text-align: right; max-width: 140px; overflow: hidden; text-overflow: ellipsis;}}

    /* PIPELINE VIZ */
    .sage-pipeline {{
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 12px 0;
        overflow-x: auto;
    }}
    .sage-pipeline-step {{
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        min-width: 70px;
    }}
    .sage-pipeline-dot {{
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        border: 2px solid {BORDER_SUBTLE};
        background: {BG_CARD};
        color: {TEXT_MUTED};
        transition: all 0.3s;
    }}
    .sage-pipeline-dot.active {{
        background: {ACCENT_PRIMARY};
        border-color: {ACCENT_PRIMARY};
        color: white;
        box-shadow: 0 0 12px rgba(102,126,234,0.5);
        animation: pulse-dot 1.5s infinite;
    }}
    .sage-pipeline-dot.done {{
        background: {SUCCESS};
        border-color: {SUCCESS};
        color: white;
    }}
    @keyframes pulse-dot {{
        0%, 100% {{ box-shadow: 0 0 12px rgba(102,126,234,0.5); }}
        50% {{ box-shadow: 0 0 20px rgba(102,126,234,0.8); }}
    }}
    .sage-pipeline-label {{
        font-size: 9px;
        font-weight: 600;
        color: {TEXT_MUTED};
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }}
    .sage-pipeline-label.active {{color: {TEXT_ACCENT};}}
    .sage-pipeline-label.done {{color: {SUCCESS};}}
    .sage-pipeline-line {{
        width: 24px;
        height: 2px;
        background: {BORDER_SUBTLE};
        margin-bottom: 18px;
    }}
    .sage-pipeline-line.done {{
        background: {SUCCESS};
    }}

    /* COMPOSER - Universal */
    .sage-composer {{
        display: flex;
        align-items: center;
        gap: 10px;
        background: {BG_CARD};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 14px;
        padding: 12px 14px;
        margin-top: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        transition: all 0.2s;
    }}
    .sage-composer:focus-within {{
        border-color: {ACCENT_PRIMARY};
        box-shadow: 0 0 0 3px rgba(102,126,234,0.15), 0 4px 20px rgba(0,0,0,0.2);
    }}
    .sage-composer-icons {{
        display: flex;
        gap: 6px;
    }}
    .sage-composer-icon {{
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: {BG_INPUT};
        border: 1px solid {BORDER_SUBTLE};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: {TEXT_SECONDARY};
        transition: all 0.2s;
    }}
    .sage-composer-icon:hover {{
        background: {BG_HOVER};
        color: {TEXT_PRIMARY};
        border-color: {BORDER_MEDIUM};
    }}
    .sage-composer-input {{
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: {TEXT_PRIMARY};
        font-size: 13px;
        font-family: 'Inter', sans-serif;
    }}
    .sage-composer-input::placeholder {{
        color: {TEXT_MUTED};
    }}
    .sage-send-btn {{
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: {GRADIENT_BUTTON};
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        transition: all 0.2s;
    }}
    .sage-send-btn:hover {{
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(102,126,234,0.4);
    }}

    /* ATTACHMENTS */
    .sage-attachment-preview {{
        background: {BG_TERTIARY};
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 10px;
        padding: 10px;
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
    }}
    .sage-attachment-thumb {{
        width: 48px;
        height: 48px;
        border-radius: 8px;
        object-fit: cover;
        background: {BG_CARD};
        border: 1px solid {BORDER_SUBTLE};
    }}

    /* CONVERSATION LIST */
    .sage-conv-item {{
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
        margin-bottom: 4px;
    }}
    .sage-conv-item:hover {{
        background: {BG_HOVER};
        border-color: {BORDER_SUBTLE};
    }}
    .sage-conv-item.active {{
        background: {BG_CARD};
        border-color: {BORDER_MEDIUM};
    }}
    .sage-conv-title {{
        font-size: 12px;
        font-weight: 500;
        color: {TEXT_PRIMARY};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }}
    .sage-conv-time {{
        font-size: 10px;
        color: {TEXT_MUTED};
        margin-top: 2px;
    }}

    /* STREAMLIT OVERRIDES */
    .stTextInput > div > div > input {{
        background: {BG_CARD} !important;
        border: 1px solid {BORDER_SUBTLE} !important;
        border-radius: 10px !important;
        color: {TEXT_PRIMARY} !important;
        font-size: 13px !important;
    }}
    .stTextInput > div > div > input:focus {{
        border-color: {ACCENT_PRIMARY} !important;
        box-shadow: 0 0 0 3px rgba(102,126,234,0.15) !important;
    }}
    .stButton > button {{
        background: {GRADIENT_BUTTON} !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        font-weight: 600 !important;
        font-size: 12px !important;
        box-shadow: 0 4px 12px rgba(102,126,234,0.25) !important;
        transition: all 0.2s !important;
    }}
    .stButton > button:hover {{
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 16px rgba(102,126,234,0.35) !important;
    }}
    .stFileUploader > div {{
        background: {BG_CARD} !important;
        border: 1px dashed {BORDER_MEDIUM} !important;
        border-radius: 10px !important;
    }}

    /* Expander */
    .streamlit-expanderHeader {{
        background: {BG_TERTIARY} !important;
        border: 1px solid {BORDER_SUBTLE} !important;
        border-radius: 8px !important;
        color: {TEXT_SECONDARY} !important;
        font-size: 12px !important;
    }}

    /* Hide extra */
    div[data-testid="stVerticalBlock"] > div:empty {{display: none;}}

    /* AUDIO WAVEFORM */
    .sage-wave {{
        display: flex;
        align-items: center;
        gap: 2px;
        height: 32px;
    }}
    .sage-wave-bar {{
        width: 3px;
        background: {GRADIENT_PRIMARY};
        border-radius: 2px;
        animation: wave 1s infinite ease-in-out;
    }}
    @keyframes wave {{
        0%, 100% {{height: 8px;}}
        50% {{height: 24px;}}
    }}

    /* MARKDOWN OVERRIDES INSIDE RESPONSE */
    .sage-response-body ul {{
        padding-left: 18px;
    }}
    .sage-response-body li {{
        margin-bottom: 4px;
    }}

    /* TO FIX STREAMLIT COLUMNS GAP */
    [data-testid="column"] {{
        padding: 0 6px;
    }}

    /* MOBILE */
    @media (max-width: 1200px) {{
        .sage-intent-grid {{grid-template-columns: repeat(3, 1fr);}}
    }}
    </style>
    """
    st.markdown(css, unsafe_allow_html=True)
