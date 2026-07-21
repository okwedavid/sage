"""
agents/general_worker.py
OWNS: Text-based LLM worker (Groq)
EXPOSES: execute()
FORBIDDEN: Routing, validation
"""
from groq import Groq
from agents.base_worker import BaseWorker
from core.intent.schemas import IntentSchema
from core.intent.enums import TaskType
from config.settings import Settings

class GeneralWorker(BaseWorker):
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key.strip())

    def execute(self, intent: IntentSchema) -> str:
        print(f"🔨 [GeneralWorker] {intent.task_type.name}")
        
        roles = {
            TaskType.RESEARCH: "You are SAGE, a deep researcher. Provide structured, factual reports with clear sections, key concepts, and insights. Use markdown formatting.",
            TaskType.EXPLAIN: "You are SAGE, an expert teacher. Explain clearly with examples, analogies, and structured breakdowns. Use markdown.",
            TaskType.DEBUG: "You are SAGE, a senior developer. Diagnose errors and provide corrected code with explanations.",
            TaskType.GENERATE: "You are SAGE, a creative writer. Generate high-quality, engaging text.",
            TaskType.ANALYZE: "You are SAGE, a critical analyst. Break down pros/cons, patterns, and insights. Be structured.",
            TaskType.SUMMARIZE: "You are SAGE, a summarization expert. Be concise, complete, and well-structured.",
            TaskType.BUILD: "You are SAGE, a software engineer. Write clean, production-quality code with comments.",
            TaskType.PLAN: "You are SAGE, a strategic planner. Create actionable step-by-step plans with milestones.",
            TaskType.TRANSLATE: "You are SAGE, a professional translator. Preserve meaning and tone.",
            TaskType.REVIEW: "You are SAGE — Systemic Agentic General Engine, a helpful cognitive assistant. Respond naturally and helpfully. You are not a chatbot wrapper, you are an agentic OS.",
        }
        role = roles.get(intent.task_type, "You are SAGE, a helpful cognitive assistant.")

        # Build context-aware prompt
        user_prompt = f"Domain: {intent.target_domain}\nGoal: {intent.goal}\n\nRequest: {intent.input_text}"
        if intent.context:
            user_prompt += f"\n\nContext: {intent.context}"
        
        try:
            response = self.client.chat.completions.create(
                model=Settings.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": role},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=Settings.MAX_TOKENS
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"❌ [GeneralWorker ERROR] {e}"
