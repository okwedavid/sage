import json
import os
from groq import Groq
from .schemas import IntentSchema
from .enums import TaskType, Priority, Status, OutputFormat

class IntentClassifier:
    def __init__(self, api_key):
        # Initialize the Groq Client
        self.client = Groq(api_key=api_key)
        
        # The System Prompt defines WHO the AI is.
        # It must be strict about outputting valid JSON.
        self.system_prompt = """
You are SAGE-Classifier, a highly precise intent recognition engine.
Your ONLY job is to analyze user input and convert it into a structured JSON format.

CRITICAL RULES:
1. Identify the PRIMARY intent.
2. Classify the DOMAIN (e.g., Coding, Networking, Finance, Creative Writing).
3. Assign PRIORITY based on urgency words (e.g., "fix", "emergency", "help").
4. Return EXACTLY valid JSON, nothing else.
5. Do not solve the task. Only classify it.

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

    def classify(self, text_input: str) -> IntentSchema:
        """
        Takes raw text -> Calls Groq -> Returns Populated IntentSchema
        """

        print("🤖 Consulting SAGE Neural Interface...")
        
        try:
            response = self.client.chat.completions.create(
                # CHANGED: Using the 'Versatile' model - very stable for logic
                model="llama-3.3-70b-versatile", 
                
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Classify this intent:\n\n{text_input}"}
                ],
                
                # UPGRADE: Force the AI to output valid JSON automatically
                # This prevents the AI from chattering or adding markdown ``` tags
                response_format={"type": "json_object"},
                
                temperature=0.1, 
                max_tokens=200
            )
            
            # Extract the content. Depending on the SDK, content may already be
            # a dict (parsed JSON) or a string. Handle both cases.
            raw_response = response.choices[0].message.content

            if isinstance(raw_response, str):
                try:
                    data = json.loads(raw_response)
                except json.JSONDecodeError:
                    raise RuntimeError("Neural Interface Error: returned invalid JSON")
            elif isinstance(raw_response, dict):
                data = raw_response
            else:
                raise RuntimeError("Neural Interface Error: unexpected response format")
            
            # Validate and map fields
            task_type_raw = data.get("task_type")
            priority_raw = data.get("priority")
            confidence_raw = data.get("confidence_score")

            if not task_type_raw or not priority_raw or confidence_raw is None:
                raise ValueError("The AI returned incomplete intent data")

            try:
                task_type = TaskType[task_type_raw.upper()]
            except Exception as e:
                raise ValueError(f"The AI returned an unknown task type: {task_type_raw}")

            try:
                priority = Priority[priority_raw.upper()]
            except Exception as e:
                raise ValueError(f"The AI returned an unknown priority: {priority_raw}")

            try:
                confidence_score = float(confidence_raw)
            except Exception:
                raise ValueError("Invalid confidence_score value")

                        # OLD (BROKEN):
            # status="VALIDATED"
            
            # NEW (CORRECT):
            return IntentSchema(
                input_text=text_input,
                task_type=TaskType[data.get("task_type", "REVIEW").upper()],
                target_domain=data.get("target_domain", "General"),
                confidence_score=float(data.get("confidence_score", 0.5)),
                goal=data.get("summary", ""),
                priority=Priority[data.get("priority", "NORMAL").upper()],
                entities=data.get("entities", {}),
                status=Status.RECEIVED,          # Proper Enum now
                output_format=OutputFormat.MARKDOWN  # Default output
            )

        except KeyError as e:
            raise ValueError(f"The AI returned an unknown task type: {e}")
        except Exception as e:
            raise RuntimeError(f"Neural Interface Error: {e}")