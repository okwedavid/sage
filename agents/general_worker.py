import json
import os
from groq import Groq
# Import the Base Class we just made above
from agents.base_worker import BaseWorker
# Import Data structures from Core
from core.intent.schemas import IntentSchema
from core.intent.enums import TaskType

class GeneralWorker(BaseWorker):
    """
    This agent handles heavy lifting.
    It changes its behavior dynamically based on the TaskType given to it.
    """
    
    # We initialize with the API key
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)

    def execute(self, intent: IntentSchema) -> str:
        
        print(f"🔨 [Agent] Executing {intent.task_type.name} task...")
        
        # --- DYNAMIC PERSONALITY SWITCHING ---
        # We look up what kind of expert we need to be based on the ENUM
        
        system_instructions = {
            TaskType.RESEARCH: "You are a deep researcher. Provide structured, factual reports.",
            TaskType.EXPLAIN: "You are an expert teacher. Explain clearly.",
            TaskType.DEBUG: "You are a senior python developer. Diagnose errors and provide corrected code blocks.",
            TaskType.GENERATE: "You are a creative writer. Generate high-quality text.",
            TaskType.ANALYZE: "You are a critical analyst. Break down pros/cons."
        }
        
        # Get the personality instruction, defaulting to helper if unknown
        role = system_instructions.get(intent.task_type, "You are a helpful assistant.")
        
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile", 
                messages=[
                    {"role": "system", "content": role},
                    {
                        "role": "user", 
                        "content": f"""
                        Domain Context: {intent.target_domain}
                        
                        User Request: {intent.input_text}
                        
                        Please perform the {intent.task_type.value} task requested.
                        """
                    }
                ],
                temperature=0.7,
                max_tokens=1024
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            return f"[WORKER ERROR] Agent failed execution: {e}"