"""
OWNS: Every color value in the SAGE interface.
EXPOSES: Color constants grouped by purpose.
FORBIDDEN: Must never import Streamlit or any framework.
"""


class Palette:
    """
    The official SAGE color system.
    Inspired by Linear, Vercel, and Arc Browser.
    """
    
    # === BRAND ===
    PRIMARY        = "#667eea"
    PRIMARY_LIGHT  = "#8b9cf7"
    SECONDARY      = "#764ba2"
    ACCENT         = "#f093fb"
    GRADIENT       = "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)"
    
    # === BACKGROUNDS ===
    BG_PRIMARY     = "#0a0a0f"
    BG_SECONDARY   = "#0e1117"
    BG_TERTIARY    = "#161b22"
    BG_CARD        = "#1a1a2e"
    BG_ELEVATED    = "#1e2130"
    BG_HOVER       = "#252540"
    
    # === BORDERS ===
    BORDER_DEFAULT = "#1e2130"
    BORDER_HOVER   = "#333355"
    BORDER_ACTIVE  = "#667eea"
    
    # === TEXT ===
    TEXT_PRIMARY   = "#e6edf3"
    TEXT_SECONDARY = "#8b949e"
    TEXT_MUTED     = "#484f58"
    TEXT_INVERSE   = "#0a0a0f"
    
    # === SEMANTIC ===
    SUCCESS        = "#3fb950"
    WARNING        = "#f0883e"
    ERROR          = "#f85149"
    INFO           = "#58a6ff"
    
    # === INTENT COLORS ===
    INTENT_TYPE       = "#667eea"
    INTENT_DOMAIN     = "#c9d1d9"
    INTENT_AGENT      = "#f778ba"
    INTENT_CONFIDENCE = "#3fb950"
    INTENT_STATUS     = "#3fb950"
    
    # === PRIORITY COLORS ===
    PRIORITY = {
        "LOW":      "#8b949e",
        "NORMAL":   "#f0883e",
        "HIGH":     "#f85149",
        "CRITICAL": "#ff0000",
    }
    
    # === AGENT COLORS ===
    AGENT = {
        "GeneralWorker": "#667eea",
        "WebWorker":     "#58a6ff",
        "VisionWorker":  "#f778ba",
        "ImageWorker":   "#f093fb",
        "VideoWorker":   "#ff6b6b",
        "ReportWorker":  "#3fb950",
    }