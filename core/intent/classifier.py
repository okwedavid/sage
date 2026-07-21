import json
import re
from groq import Groq
from .schemas import IntentSchema
from .enums import TaskType, Priority, Status, OutputFormat


class IntentClassifier:
    """
    OWNS: Converting raw text into a structured IntentSchema.
    EXPOSES: classify() method.
    FORBIDDEN: Must never execute tasks or render UI.
    """
    
    def __init__(self, api_key):
        self.client = Groq(api_key=api_key)
        self.system_prompt = """
You are SAGE-Classifier, a highly precise intent recognition engine.
Your ONLY job is to analyze user input and convert it into a structured JSON format.

CRITICAL RULES:
1. Identify the PRIMARY intent.
2. Classify the DOMAIN (e.g., Coding, Networking, Finance, Creative Writing, Web).
3. Assign PRIORITY based on urgency words (e.g., "fix", "emergency", "help").
4. If the input contains a URL/link, set task_type to "RESEARCH" or "ANALYZE".
5. Return EXACTLY valid JSON, nothing else.
6. Do not solve the task. Only classify it.

AVAILABLE TASK_TYPES: [BUILD, ANALYZE, RESEARCH, SUMMARIZE, PLAN, DEBUG, EXPLAIN, GENERATE, TRANSLATE, REVIEW]
AVAILABLE PRIORITIES: [LOW, NORMAL, HIGH, CRITICAL]

JSON FORMAT:
{
    "task_type": "DEBUG",
    "target_domain": "Python",
    "confidence_score": 0.95,
    "priority": "HIGH",
    "entities": {},
    "summary": "One sentence summary of the user request."
}
"""

    def _contains_url(self, text: str) -> bool:
        """Check if the input contains any URLs."""
        url_pattern = re.compile(r'https?://[^\s]+', re.IGNORECASE)
        return bool(url_pattern.search(text))

    def classify(self, text_input: str) -> IntentSchema:
        print("🤖 Consulting SAGE Neural Interface...")
        
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Classify this intent:\n\n{text_input}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=200
            )
            
            raw_response = response.choices[0].message.content
            data = json.loads(raw_response)
            
            # Auto-detect URL presence and override task type if needed
            task_type_str = data.get("task_type", "REVIEW").upper()
            
            if self._contains_url(text_input) and task_type_str not in ["RESEARCH", "ANALYZE"]:
                task_type_str = "RESEARCH"
                data["target_domain"] = "Web"
            
            return IntentSchema(
                input_text=text_input,
                task_type=TaskType[task_type_str],
                target_domain=data.get("target_domain", "General"),
                confidence_score=float(data.get("confidence_score", 0.5)),
                goal=data.get("summary", ""),
                priority=Priority[data.get("priority", "NORMAL").upper()],
                entities=data.get("entities", {}),
                status=Status.RECEIVED,
                output_format=OutputFormat.MARKDOWN
            )
            
        except KeyError as e:
            raise ValueError(f"The AI returned an unknown task type: {e}")
        except Exception as e:
            raise RuntimeError(f"Neural Interface Error: {e}")