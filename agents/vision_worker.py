"""
agents/vision_worker.py
OWNS: Image analysis via multimodal LLM
EXPOSES: execute()
FORBIDDEN: Audio, routing
"""
from groq import Groq
from agents.base_worker import BaseWorker
from core.intent.schemas import IntentSchema
from config.settings import Settings

class VisionWorker(BaseWorker):
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key.strip())

    def execute(self, intent: IntentSchema) -> str:
        print("👁️ [VisionWorker] Analyzing...")
        
        img_b64 = intent.attachments.get("image_base64")
        img_type = intent.attachments.get("image_type", "jpeg")
        img_name = intent.attachments.get("image_name", "uploaded image")
        
        if not img_b64:
            print("⚠️ VisionWorker: No image_base64 found, fallback")
            return self._fallback(intent)
        
        question = intent.input_text.strip()
        if not question or question.lower() in ["[image uploaded]", "image attached", "[image attached] what can you tell me about the image?", "here is the image, check the image attached"]:
            question = "Analyze this image in detail. Describe what you see, key components, and provide insights. If it's a diagram, explain the architecture/flow. If it's a photo, describe subjects, context, and notable details."

        # Try primary vision model, then fallbacks
        models_to_try = [
            Settings.VISION_MODEL,
            getattr(Settings, "VISION_FALLBACK", None),
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "llama-3.2-90b-vision-preview",
            "llama-3.2-11b-vision-preview",
        ]
        models_to_try = [m for m in models_to_try if m]

        last_error = None
        for model_id in models_to_try:
            try:
                print(f"👁️ Trying vision model: {model_id}")
                resp = self.client.chat.completions.create(
                    model=model_id,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": question},
                            {"type": "image_url", "image_url": {"url": f"data:image/{img_type};base64,{img_b64}"}}
                        ]
                    }],
                    temperature=0.3,
                    max_tokens=Settings.VISION_MAX_TOKENS
                )
                analysis = resp.choices[0].message.content
                return f"👁️ **Vision Analysis** — `{img_name}` (via `{model_id}`)\n\n---\n\n{analysis}"
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "decommissioned" in err_str or "not found" in err_str or "model" in err_str:
                    print(f"⚠️ Model {model_id} failed: {e} — trying next")
                    continue
                else:
                    print(f"⚠️ Vision error with {model_id}: {e}")
                    break

        # All vision models failed
        err_msg = str(last_error) if last_error else "Unknown"
        return f"⚠️ All vision models failed. Last error: {err_msg}\n\nTrying text fallback...\n\n{self._fallback_vision_with_text(question, err_msg)}"

    def _fallback(self, intent):
        try:
            resp = self.client.chat.completions.create(
                model=Settings.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": "You are SAGE Vision assistant. User wanted image analysis but no image was processed. Ask for description or help with visual topics. Be helpful."},
                    {"role": "user", "content": intent.input_text}
                ],
                temperature=0.7, max_tokens=Settings.MAX_TOKENS
            )
            return resp.choices[0].message.content
        except Exception as e:
            return f"[VisionWorker Fallback ERROR] {e}"

    def _fallback_vision_with_text(self, question, error):
        try:
            resp = self.client.chat.completions.create(
                model=Settings.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": "You are SAGE, explain that vision model is temporarily unavailable and provide guidance on how to describe images for analysis."},
                    {"role": "user", "content": question}
                ],
                temperature=0.7, max_tokens=512
            )
            return resp.choices[0].message.content
        except Exception as e2:
            return f"Vision unavailable: {error} | Fallback also failed: {e2}"
