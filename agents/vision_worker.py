import base64
from groq import Groq
from agents.base_worker import BaseWorker
from core.intent.schemas import IntentSchema
from config.settings import Settings


class VisionWorker(BaseWorker):
    """
    OWNS: Image analysis via multimodal LLMs.
    EXPOSES: execute() method that reads image attachments from IntentSchema.
    FORBIDDEN: Must never classify intents, handle audio, or render UI.
    """
    
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
    
    def execute(self, intent: IntentSchema) -> str:
        """
        Analyzes an image attached to the intent.
        
        Expected attachments format:
            intent.attachments = {
                "image_base64": "base64_encoded_string",
                "image_type": "jpeg" | "png" | "webp"
            }
        """
        
        print(f"👁️ [VisionWorker] Analyzing image...")
        
        # Extract image data from the intent
        image_b64 = intent.attachments.get("image_base64")
        image_type = intent.attachments.get("image_type", "jpeg")
        
        if not image_b64:
            return self._text_fallback(intent)
        
        # Build the user question
        # If user typed something, use that as the question
        # If they just uploaded an image with no text, default to analysis
        user_question = intent.input_text.strip()
        if not user_question or user_question == "[Image uploaded]":
            user_question = (
                "Analyze this image in detail. Describe what you see, "
                "identify key elements, and provide any relevant insights."
            )
        
        try:
            response = self.client.chat.completions.create(
                model=Settings.VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text", 
                                "text": user_question
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/{image_type};base64,{image_b64}"
                                }
                            }
                        ]
                    }
                ],
                temperature=0.3,
                max_tokens=Settings.VISION_MAX_TOKENS
            )
            
            answer = response.choices[0].message.content
            return f"👁️ **Vision Analysis**\n\n---\n\n{answer}"
            
        except Exception as e:
            return f"[VisionWorker ERROR] Image analysis failed: {e}"
    
    def _text_fallback(self, intent: IntentSchema) -> str:
        """
        If no image is attached, behave like a general assistant.
        """
        try:
            response = self.client.chat.completions.create(
                model=Settings.DEFAULT_MODEL,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful assistant specialized in visual topics."
                    },
                    {"role": "user", "content": intent.input_text}
                ],
                temperature=0.7,
                max_tokens=1024
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"[VisionWorker ERROR] Fallback failed: {e}"