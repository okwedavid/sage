"""
ui/styles/palette.py
OWNS: Every color constant
EXPOSES: Color variables
FORBIDDEN: CSS generation, UI logic
"""

# Backgrounds - deep dark immersive
BG_PRIMARY = "#0a0a0f"      # main app bg
BG_SECONDARY = "#0f0f17"    # sidebar bg
BG_TERTIARY = "#12121a"     # card secondary
BG_SURFACE = "#15151f"
BG_CARD = "#1c1e2e"
BG_INPUT = "#1e2130"
BG_HOVER = "#252836"

# Borders
BORDER_SUBTLE = "#1e2130"
BORDER_MEDIUM = "#2a2d45"
BORDER_ACCENT = "#3a3f68"

# Accents - purple-blue gradient theme
ACCENT_PRIMARY = "#667eea"
ACCENT_SECONDARY = "#764ba2"
ACCENT_TERTIARY = "#f093fb"
ACCENT_GLOW = "#8b5cf6"

GRADIENT_PRIMARY = "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)"
GRADIENT_BUTTON = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
GRADIENT_TEXT = "linear-gradient(135deg, #a78bfa 0%, #f093fb 100%)"
GRADIENT_BORDER = "linear-gradient(135deg, rgba(102,126,234,0.5) 0%, rgba(118,75,162,0.5) 50%, rgba(240,147,251,0.5) 100%)"
GRADIENT_CARD_GLOW = "radial-gradient(600px circle at 0% 0%, rgba(102,126,234,0.15), transparent 80%)"

# Text
TEXT_PRIMARY = "#e4e4e7"
TEXT_SECONDARY = "#a1a1aa"
TEXT_MUTED = "#71717a"
TEXT_ACCENT = "#a78bfa"
TEXT_ON_ACCENT = "#ffffff"

# Status
SUCCESS = "#3fb950"
SUCCESS_BG = "rgba(63,185,80,0.1)"
WARNING = "#f0883e"
WARNING_BG = "rgba(240,136,62,0.1)"
ERROR = "#f85149"
ERROR_BG = "rgba(248,81,73,0.1)"
INFO = "#58a6ff"
INFO_BG = "rgba(88,166,255,0.1)"

# Task Type Colors
TASK_COLORS = {
    "RESEARCH": "#58a6ff",
    "ANALYZE": "#a78bfa",
    "BUILD": "#3fb950",
    "EXPLAIN": "#f0883e",
    "DEBUG": "#f85149",
    "GENERATE": "#f093fb",
    "SUMMARIZE": "#8b949e",
    "PLAN": "#d2a8ff",
    "REVIEW": "#a1a1aa"
}

# Priority Colors
PRIORITY_COLORS = {
    "LOW": "#8b949e",
    "NORMAL": "#e3b341",
    "HIGH": "#f0883e",
    "CRITICAL": "#f85149"
}

# Tools
TOOL_ICONS = {
    "Web Search": "🌐",
    "Image Analysis": "🖼️",
    "Image Generation": "🎨",
    "Voice Input": "🎤",
    "Text to Speech": "🔊"
}
