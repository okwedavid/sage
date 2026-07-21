"""
OWNS: Rendering a single SAGE response with action bar.
EXPOSES: render_response()
FORBIDDEN: Must never call the pipeline or modify history.
"""

import streamlit as st


def render_response(exchange: dict, index: int):
    """
    Renders a complete SAGE response block inside a chat_message context.
    
    Includes:
        - Intent metadata table (if successful)
        - Response text (markdown)
        - Action bar: Copy | Listen | Save
    
    Args:
        exchange: A history entry dict
        index: The position in history (for unique widget keys)
    """
    from ui.components.intent_card import render_intent_table
    
    # --- Intent Table ---
    if exchange.get("success") and exchange.get("intent_data"):
        idata = exchange["intent_data"]
        # Backward compatibility
        idata.setdefault("output_format", "MARKDOWN")
        idata.setdefault("priority", "NORMAL")
        
        st.markdown("**✅ Intent Recognized**")
        render_intent_table(idata)
    
    # --- Response Body ---
    st.markdown(exchange["response"])
    
    # --- Action Bar ---
    if exchange.get("success"):
        _render_action_bar(exchange, index)


def _render_action_bar(exchange: dict, index: int):
    """The Copy | Listen | Save row beneath each response."""
    
    col_copy, col_listen, col_save, col_spacer = st.columns([1, 1, 1, 4])
    
    # COPY — Uses st.code which has a built-in copy icon
    with col_copy:
        if st.button("📋 Copy", key=f"copy_{index}", use_container_width=True):
            # Toggle: show/hide the code block
            key = f"show_copy_{index}"
            st.session_state[key] = not st.session_state.get(key, False)
    
    # Show copyable text block if toggled
    if st.session_state.get(f"show_copy_{index}", False):
        st.code(exchange["response"], language=None)
    
    # LISTEN — Text-to-Speech
    with col_listen:
        if st.session_state.get("tts_enabled", False):
            audio_cache = f"audio_{index}"
            
            if audio_cache not in st.session_state:
                if st.button("🔊 Listen", key=f"listen_{index}", use_container_width=True):
                    try:
                        audio_svc = st.session_state.audio_service
                        if audio_svc:
                            audio_bytes = audio_svc.synthesize(exchange["response"])
                            st.session_state[audio_cache] = audio_bytes
                            st.rerun()
                    except Exception as e:
                        st.error(f"TTS: {e}")
            else:
                st.audio(st.session_state[audio_cache], format="audio/mp3")
    
    # SAVE — Download as markdown
    with col_save:
        st.download_button(
            "⬇️ Save",
            data=exchange["response"],
            file_name=f"sage_response_{index}.md",
            mime="text/markdown",
            key=f"dl_{index}",
            use_container_width=True
        )