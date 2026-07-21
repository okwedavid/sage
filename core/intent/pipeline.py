"""
core/intent/pipeline.py
OWNS: Orchestrates all 5 stages sequentially
EXPOSES: IntentPipeline.process()
FORBIDDEN: Direct LLM calls (delegates to submodules)
"""
from .normalizer import IntentNormalizer
from .classifier import IntentClassifier
from .validator import IntentValidator
from .router import IntentRouter
from .enums import Status

class IntentPipeline:
    def __init__(self, api_key: str, registry):
        self.normalizer = IntentNormalizer()
        self.classifier = IntentClassifier(api_key=api_key)
        self.validator  = IntentValidator()
        self.router     = IntentRouter(registry=registry)
        print("✅ [Pipeline] All subsystems initialized.")

    def process(self, raw_input: str, attachments: dict = None) -> dict:
        if attachments is None:
            attachments = {}
        
        result = {"intent": None, "response": None, "agent": None, "success": False, "stages": []}
        
        try:
            print("\n📝 [Stage 1/5] Normalizing...")
            clean = self.normalizer.normalize(raw_input)
            result["stages"].append(("normalize", True, clean[:60]))
            print(f"   → \"{clean[:60]}...\"")

            print("🧠 [Stage 2/5] Classifying...")
            intent = self.classifier.classify(clean)
            result["stages"].append(("classify", True, f"{intent.task_type.name} ({intent.confidence_score:.0%})"))
            print(f"   → {intent.task_type.name} ({intent.confidence_score:.0%})")

            if attachments:
                intent.attachments = attachments
                print(f"   📎 Attachments: {list(attachments.keys())}")

            print("🔍 [Stage 3/5] Validating...")
            intent = self.validator.validate(intent)
            result["stages"].append(("validate", intent.status != Status.FAILED, intent.status.name))
            if intent.status == Status.FAILED:
                result["intent"] = intent
                result["response"] = f"Rejected: {intent.context}"
                return result

            print("🔀 [Stage 4/5] Routing...")
            worker, agent_name = self.router.route(intent)
            result["stages"].append(("route", True, agent_name))

            print(f"⚡ [Stage 5/5] Executing via {agent_name}...")
            intent.advance_status(Status.EXECUTING)
            response_text = worker.execute(intent)
            intent.advance_status(Status.COMPLETED)
            result["stages"].append(("execute", True, "DONE"))

            result.update({
                "intent": intent,
                "response": response_text,
                "agent": agent_name,
                "success": True
            })
            print(f"✅ [Pipeline] Complete: {intent.status.name}")

        except Exception as e:
            print(f"❌ [Pipeline] Failed: {e}")
            result["response"] = f"System Error: {e}"
            import traceback
            traceback.print_exc()
        
        return result
