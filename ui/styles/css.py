"""
ui/styles/css.py — V2 EFFICIENT PREMIUM
OWNS: Complete CSS stylesheet injection with fixed scroll panes
EXPOSES: inject_css()
FORBIDDEN: Python logic beyond styling
"""
import streamlit as st
from .palette import *

def inject_css():
    css = f"""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap');

    html, body, [class*="css"] {{
        font-family: 'Inter', sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }}

    /* ===== EFFICIENCY CORE FIX ===== */
    html {{
        overflow: hidden !important;
        height: 100vh !important;
    }}
    body {{
        overflow: hidden !important;
        height: 100vh !important;
        margin: 0 !important;
    }}
    .stApp {{
        background: {BG_PRIMARY} !important;
        background-image: 
            radial-gradient(ellipse at 10% -20%, rgba(102,126,234,0.18) 0%, transparent 55%),
            radial-gradient(ellipse at 90% 120%, rgba(118,75,162,0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(240,147,251,0.03) 0%, transparent 70%) !important;
        height: 100vh !important;
        overflow: hidden !important;
        display: flex;
        flex-direction: column;
    }}
    .main .block-container {{
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        height: 100vh !important;
        display: flex;
        flex-direction: column;
        overflow: hidden !important;
    }}
    section[data-testid="stVerticalBlock"] {{
        gap: 0 !important;
        height: 100vh;
        overflow: hidden;
    }}

    /* Hide chrome */
    #MainMenu {{visibility: hidden;}}
    footer {{visibility: hidden;}}
    header {{visibility: hidden;}}
    .stDeployButton {{display: none;}}
    [data-testid="stStatusWidget"] {{display: none;}}
    [data-testid="stToolbar"] {{display: none;}}

    /* Independent scroll panes — THE FIX */
    [data-testid="stHorizontalBlock"] {{
        height: calc(100vh - 56px) !important; /* header 56px */
        overflow: hidden !important;
        align-items: stretch !important;
        gap: 0 !important;
        flex: 1;
        display: flex !important;
    }}
    [data-testid="column"] {{
        height: calc(100vh - 56px) !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 0 10px !important;
        scrollbar-width: thin;
        scrollbar-color: {BORDER_MEDIUM} transparent;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
    }}
    /* Left panel sticky */
    [data-testid="column"]:nth-child(1) {{
        background: linear-gradient(180deg, {BG_SECONDARY} 0%, rgba(15,15,23,0.96) 100%);
        border-right: 1px solid {BORDER_SUBTLE};
        backdrop-filter: blur(20px);
        padding: 0 0 20px 0 !important;
    }}
    /* Center workspace - main scroll */
    [data-testid="column"]:nth-child(2) {{
        background: transparent;
        padding: 0 16px 100px 16px !important;
        scroll-behavior: smooth;
    }}
    /* Right inspector fixed */
    [data-testid="column"]:nth-child(3) {{
        background: rgba(15,15,23,0.5);
        border-left: 1px solid {BORDER_SUBTLE};
        backdrop-filter: blur(16px);
        padding: 12px 10px !important;
    }}

    /* Custom scrollbars - premium thin */
    [data-testid="column"]::-webkit-scrollbar {{
        width: 4px;
    }}
    [data-testid="column"]::-webkit-scrollbar-track {{
        background: transparent;
    }}
    [data-testid="column"]::-webkit-scrollbar-thumb {{
        background: {BORDER_MEDIUM};
        border-radius: 10px;
    }}
    [data-testid="column"]::-webkit-scrollbar-thumb:hover {{
        background: {ACCENT_PRIMARY};
    }}

    /* ===== HEADER — sticky ===== */
    .sage-header {{
        position: sticky;
        top: 0;
        z-index: 100;
        height: 56px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px;
        background: rgba(15,15,23,0.85);
        backdrop-filter: blur(24px) saturate(1.2);
        border-bottom: 1px solid {BORDER_SUBTLE};
        flex-shrink: 0;
    }}
    .sage-logo-text {{
        font-family: 'Space Grotesk', sans-serif !important;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.03em;
        background: {GRADIENT_TEXT};
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }}

    /* ===== PREMIUM ICON SYSTEM — SVG not emoji ===== */
    .icon {{
        width: 18px;
        height: 18px;
        stroke-width: 1.6;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }}
    .icon-sm {{width: 14px; height: 14px;}}
    .icon-lg {{width: 22px; height: 22px;}}

    /* Nav items with SVG */
    .sage-nav-item {{
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 10px;
        color: {TEXT_SECONDARY};
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.22s cubic-bezier(0.2,0,0,1);
        border: 1px solid transparent;
        margin-bottom: 2px;
        position: relative;
        overflow: hidden;
    }}
    .sage-nav-item::before {{
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(102,126,234,0.08), transparent);
        opacity: 0;
        transition: opacity 0.22s;
    }}
    .sage-nav-item:hover {{
        background: {BG_HOVER};
        color: {TEXT_PRIMARY};
        border-color: rgba(102,126,234,0.15);
        transform: translateX(2px);
    }}
    .sage-nav-item:hover::before {{opacity: 1;}}
    .sage-nav-item.active {{
        background: linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.12) 100%);
        border-color: rgba(102,126,234,0.25);
        color: {TEXT_PRIMARY};
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(102,126,234,0.12);
    }}
    .sage-nav-item.active svg {{
        stroke: {ACCENT_PRIMARY};
    }}

    /* New Chat premium button */
    .stButton > button[kind="primary"],
    button[data-testid="stBaseButton-primary"] {{
        background: {GRADIENT_BUTTON} !important;
        border: none !important;
        border-radius: 12px !important;
        font-weight: 600 !important;
        letter-spacing: -0.01em !important;
        box-shadow: 0 2px 10px rgba(102,126,234,0.3), inset 0 1px 0 rgba(255,255,255,0.15) !important;
        transition: all 0.22s cubic-bezier(0.2,0,0,1) !important;
        position: relative;
        overflow: hidden;
    }}
    .stButton > button:hover {{
        transform: translateY(-1px) scale(1.01) !important;
        box-shadow: 0 6px 20px rgba(102,126,234,0.4), inset 0 1px 0 rgba(255,255,255,0.2) !important;
    }}
    .stButton > button:active {{
        transform: translateY(0) scale(0.99) !important;
    }}

    /* Message bubbles - efficient compositing */
    .sage-msg-user {{
        background: {GRADIENT_BUTTON};
        color: white;
        padding: 14px 18px;
        border-radius: 20px 20px 6px 20px;
        font-size: 13.5px;
        max-width: 72%;
        margin-left: auto;
        margin-bottom: 18px;
        box-shadow: 0 4px 20px rgba(102,126,234,0.25), inset 0 1px 0 rgba(255,255,255,0.15);
        line-height: 1.6;
        font-weight: 450;
        will-change: transform;
        animation: slideIn 0.35s cubic-bezier(0.2,0,0,1);
    }}
    @keyframes slideIn {{
        from {{ opacity:0; transform: translateY(10px) scale(0.98); }}
        to {{ opacity:1; transform: translateY(0) scale(1); }}
    }}
    .sage-msg-assistant {{
        display: flex;
        gap: 14px;
        margin-bottom: 24px;
        animation: fadeIn 0.4s ease;
    }}
    @keyframes fadeIn {{ from {{opacity:0;}} to {{opacity:1;}} }}

    /* Intent card - glass */
    .sage-intent-card {{
        background: linear-gradient(180deg, rgba(28,30,46,0.9) 0%, rgba(21,21,31,0.9) 100%);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(102,126,234,0.15);
        border-bottom: none;
        border-radius: 14px 14px 0 0;
        padding: 16px 18px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05);
    }}
    .sage-intent-grid {{
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 10px;
    }}
    .sage-intent-value {{
        font-size: 10.5px;
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
        padding: 5px 9px;
        background: rgba(30,33,48,0.8);
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 8px;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        transition: all 0.2s;
    }}
    .sage-intent-value:hover {{
        border-color: rgba(102,126,234,0.3);
        transform: translateY(-1px);
    }}

    /* Response card */
    .sage-response-card {{
        background: rgba(24,24,37,0.85);
        backdrop-filter: blur(20px);
        border: 1px solid {BORDER_SUBTLE};
        border-top: 1px solid rgba(42,45,69,0.8);
        border-radius: 0 0 14px 14px;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0,0,0,0.25);
    }}
    .sage-response-body {{
        padding: 22px 24px;
        font-size: 13.5px;
        line-height: 1.75;
        color: {TEXT_PRIMARY};
    }}

    /* Tools - premium hover */
    .sage-tools-grid {{ gap: 8px; }}
    .sage-tool-item {{
        background: rgba(28,30,46,0.6);
        backdrop-filter: blur(12px);
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 12px;
        padding: 12px 14px;
        transition: all 0.24s cubic-bezier(0.2,0,0,1);
        cursor: pointer;
        position: relative;
        overflow: hidden;
    }}
    .sage-tool-item::after {{
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        transition: left 0.6s;
    }}
    .sage-tool-item:hover {{
        background: rgba(37,40,54,0.9);
        border-color: rgba(102,126,234,0.25);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(102,126,234,0.1);
    }}
    .sage-tool-item:hover::after {{ left: 100%; }}

    /* Pipeline dots */
    .sage-pipeline {{
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 4px;
        background: rgba(15,15,23,0.6);
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 12px;
        backdrop-filter: blur(12px);
        margin-bottom: 16px;
        position: sticky;
        top: 0;
        z-index: 10;
    }}

    /* Composer - fixed bottom efficient */
    .composer-wrapper {{
        position: sticky;
        bottom: 0;
        z-index: 20;
        background: linear-gradient(180deg, transparent 0%, rgba(10,10,15,0.9) 30%, {BG_PRIMARY} 70%);
        backdrop-filter: blur(20px);
        padding: 16px 0 12px 0;
        margin-top: 20px;
    }}
    .sage-composer {{
        background: rgba(28,30,46,0.9);
        backdrop-filter: blur(20px) saturate(1.2);
        border: 1px solid rgba(102,126,234,0.2);
        border-radius: 16px;
        padding: 12px 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06);
        transition: all 0.22s;
    }}
    .sage-composer:focus-within {{
        border-color: {ACCENT_PRIMARY};
        box-shadow: 0 0 0 4px rgba(102,126,234,0.15), 0 8px 32px rgba(0,0,0,0.3);
        transform: translateY(-1px);
    }}

    /* Scrollbar premium */
    ::-webkit-scrollbar {{ width: 5px; height: 5px; }}
    ::-webkit-scrollbar-track {{ background: transparent; }}
    ::-webkit-scrollbar-thumb {{
        background: linear-gradient(180deg, {BORDER_MEDIUM}, {BORDER_ACCENT});
        border-radius: 10px;
    }}
    ::-webkit-scrollbar-thumb:hover {{ background: {ACCENT_PRIMARY}; }}

    /* Text input */
    .stTextInput > div > div > input {{
        background: rgba(28,30,46,0.8) !important;
        backdrop-filter: blur(12px);
        border: 1px solid {BORDER_SUBTLE} !important;
        border-radius: 12px !important;
        color: {TEXT_PRIMARY} !important;
        font-size: 13.5px !important;
        transition: all 0.22s !important;
        height: 44px !important;
    }}
    .stTextInput > div > div > input:focus {{
        border-color: {ACCENT_PRIMARY} !important;
        box-shadow: 0 0 0 4px rgba(102,126,234,0.15) !important;
        background: rgba(37,40,54,0.9) !important;
    }}

    /* Panels */
    .sage-panel-section {{
        background: rgba(21,21,31,0.7);
        backdrop-filter: blur(16px);
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 14px;
        padding: 16px;
        transition: all 0.22s;
    }}
    .sage-panel-section:hover {{
        border-color: rgba(102,126,234,0.18);
    }}

    .sage-conv-item {{
        padding: 11px 13px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.2,0,0,1);
        border: 1px solid transparent;
        margin-bottom: 3px;
        position: relative;
    }}
    .sage-conv-item:hover {{
        background: rgba(37,40,54,0.7);
        transform: translateX(2px);
    }}
    .sage-conv-item.active {{
        background: linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.08));
        border-color: rgba(102,126,234,0.2);
    }}

    /* System status */
    .sage-system-status {{
        background: rgba(18,18,26,0.8);
        backdrop-filter: blur(12px);
        border: 1px solid {BORDER_SUBTLE};
        border-radius: 12px;
        padding: 14px;
    }}

    /* Performance */
    * {{
        -webkit-tap-highlight-color: transparent;
    }}
    .sage-tool-item, .sage-conv-item, .sage-nav-item {{
        will-change: transform;
        contain: layout style;
    }}

    /* Mobile responsive */
    @media (max-width: 1100px) {{
        [data-testid="stHorizontalBlock"] {{
            flex-direction: column !important;
            height: auto !important;
        }}
        [data-testid="column"] {{
            height: auto !important;
            max-height: 50vh;
        }}
        .sage-intent-grid {{grid-template-columns: repeat(3, 1fr);}}
    }}
    </style>
    """
    st.markdown(css, unsafe_allow_html=True)
