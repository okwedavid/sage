"""
OWNS: Processing text input from the chat composer bar.
EXPOSES: handle_input()
FORBIDDEN: Must never render chat history or sidebar elements.
"""

import streamlit as st
from ui.state import add_to_history
from ui.components.intent_card import render_intent_table
from ui.components.pipeline_viz import execute_with_viz


def handle_input():
    """
    Renders the chat_input bar and processes submitted text.
    Handles both text-only and text+image submissions.
    """
    
    prompt = st.chat_input("Ask anything... (text, voice, or upload)")
    
    if not prompt:
        return
    
    # Gather attachments
    attachments = st.session_state.pending_image or {}
    
    # Build display text
    display_text = prompt
    if attachments:
        display_text = f"📷 [Image Attached] {prompt}"
    
    # Show user message
    st.chat_message("user").write(display_text)
    
    # Process and show response
    with st.chat_message("assistant", avatar="🧠"):
        
        # Execute with live pipeline visualization
        result = execute_with_viz(
            st.session_state.pipeline, 
            prompt, 
            attachments
        )
        
        if result["success"]:
            intent = result["intent"]
            intent_data = {
                "task_type": intent.task_type.name,
                "domain": intent.target_domain,
                "agent": result["agent"],
                "confidence": f"{intent.confidence_score:.0%}",
                "status": intent.status.name,
                "priority": intent.priority.name,
                "output_format": intent.output_format.name
            }
            
            # Render intent table
            st.markdown("**✅ Intent Recognized**")
            render_intent_table(intent_data)
            
            # Render response
            st.markdown(result["response"])
            
            # Auto TTS
            if st.session_state.tts_enabled and st.session_state.audio_service:
                try:
                    tts_bytes = st.session_state.audio_service.synthesize(
                        result["response"]
                    )
                    st.audio(tts_bytes, format="audio/mp3")
                except Exception:
                    pass
            
            # Save to history
            add_to_history({
                "user": display_text,
                "response": result["response"],
                "intent_data": intent_data,
                "success": True
            })
        else:
            st.error(f"⚠️ {result['response']}")
            add_to_history({
                "user": display_text,
                "response": result["response"],
                "success": False
            })
    
    # Cleanup
    st.session_state.pending_image = None
    st.rerun()