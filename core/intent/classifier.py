"""
core/intent/classifier.py
OWNS: Groq LLM-based intent classification
EXPOSES: IntentClassifier.classify()
FORBIDDEN: Direct execution, routing
"""
import json
import re
from groq import Groq
from .schemas import IntentSchema
from .enums import TaskType, Priority, Status, OutputFormat
from config.settings import Settings

class IntentClassifier:
    def __init__(self, api_key: str):
        if not api_key or not api_key.strip().startswith("gsk_"):
            raise ValueError("Classifier requires valid Groq API key starting with gsk_")
        self.client = Groq(api_key=api_key.strip())
        self.system_prompt = """
You are SAGE-Classifier, a highly precise intent recognition engine.
Your ONLY job is to analyze user input and convert it into structured JSON.

CRITICAL RULES:
1. Identify the PRIMARY intent.
2. Classify the DOMAIN (e.g., Coding, Networking, Finance, Creative Writing, Web, Software Architecture, Computer Science).
3. Assign PRIORITY based on urgency words (e.g., "fix", "emergency", "help" = HIGH, normal = NORMAL).
4. If the input contains a URL/link, set task_type to "RESEARCH" or "ANALYZE" and target_domain to "Web".
5. If input mentions image, diagram, picture, photo, screenshot -> task_type ANALYZE, domain Computer Vision or relevant.
6. Return EXACTLY valid JSON, nothing else.
7. Do not solve the task. Only classify it.

AVAILABLE TASK_TYPES: [BUILD, ANALYZE, RESEARCH, SUMMARIZE, PLAN, DEBUG, EXPLAIN, GENERATE, TRANSLATE, REVIEW]
AVAILABLE PRIORITIES: [LOW, NORMAL, HIGH, CRITICAL]

JSON FORMAT:
{
    "task_type": "DEBUG",
    "target_domain": "Python",
    "confidence_score": 0.95,
    "priority": "HIGH",
    "entities": {},
    "summary": "One sentence summary of user goal."
}
"""

    def _contains_url(self, text: str) -> bool:
        return bool(re.search(r'https?://[^\s]+', text, re.IGNORECASE))

    def classify(self, text_input: str) -> IntentSchema:
        print("🤖 Consulting SAGE Neural Interface...")
        try:
            response = self.client.chat.completions.create(
                model=Settings.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Classify this intent:\n\n{text_input}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=300
            )
            raw = response.choices[0].message.content
            data = json.loads(raw)
            
            task_type_str = data.get("task_type", "REVIEW").upper()
            # URL override
            if self._contains_url(text_input) and task_type_str not in ["RESEARCH", "ANALYZE"]:
                task_type_str = "RESEARCH"
                data["target_domain"] = "Web"
            
            # Validate task_type enum
            if task_type_str not in TaskType.__members__:
                task_type_str = "REVIEW"

            # Validate priority
            prio = data.get("priority", "NORMAL").upper()
            if prio not in Priority.__members__:
                prio = "NORMAL"

            return IntentSchema(
                input_text=text_input,
                task_type=TaskType[task_type_str],
                target_domain=data.get("target_domain", "General"),
                confidence_score=float(data.get("confidence_score", 0.85)),
                goal=data.get("summary", ""),
                priority=Priority[prio],
                entities=data.get("entities", {}),
                status=Status.RECEIVED,
                output_format=OutputFormat.MARKDOWN
            )
        except KeyError as e:
            raise ValueError(f"Unknown task type from AI: {e}")
        except Exception as e:
            # Fallback to safe REVIEW intent if classifier fails but we have text
            print(f"⚠️ Classifier fallback due to error: {e}")
            return IntentSchema(
                input_text=text_input,
                task_type=TaskType.REVIEW,
                target_domain="General",
                confidence_score=0.5,
                goal=text_input[:100],
                priority=Priority.NORMAL,
                status=Status.RECEIVED,
                output_format=OutputFormat.MARKDOWN
            )
