from .normalizer import IntentNormalizer
from .classifier import IntentClassifier
from .validator import IntentValidator
from .router import IntentRouter
from .schemas import IntentSchema
from .enums import Status


class IntentPipeline:
    """
    OWNS: The full lifecycle of an Intent from raw text to routed execution.
    EXPOSES: process() — the single entry point for the entire system.
    FORBIDDEN: Must never contain business logic. It only orchestrates.
    
    Flow:
        Raw Text → Normalize → Classify → Validate → Route → Execute → Result
    """
    
    def __init__(self, api_key: str, registry):
        """
        Boot up all subsystems.
        Each subsystem is independent and testable on its own.
        """
        self.normalizer = IntentNormalizer()
        self.classifier = IntentClassifier(api_key=api_key)
        self.validator  = IntentValidator()
        self.router     = IntentRouter(registry=registry)
        
        print("✅ [Pipeline] All subsystems initialized.")
    
    def process(self, raw_input: str) -> dict:
        """
        The ONE function that runs the entire SAGE engine.
        
        Returns a dictionary with:
            - intent: The full IntentSchema object
            - response: The agent's output text
            - agent: Which agent handled it
            - success: True/False
        """
        
        result = {
            "intent": None,
            "response": None,
            "agent": None,
            "success": False
        }
        
        try:
            # ==============================
            # STAGE 1: NORMALIZE
            # ==============================
            print("\n📝 [Stage 1/5] Normalizing input...")
            clean_text = self.normalizer.normalize(raw_input)
            print(f"   Cleaned: \"{clean_text[:60]}...\"")
            
            # ==============================
            # STAGE 2: CLASSIFY
            # ==============================
            print("🧠 [Stage 2/5] Classifying intent...")
            intent = self.classifier.classify(clean_text)
            print(f"   Result: {intent.task_type.name} ({intent.confidence_score:.0%})")
            
            # ==============================
            # STAGE 3: VALIDATE
            # ==============================
            print("🔍 [Stage 3/5] Validating classification...")
            intent = self.validator.validate(intent)
            
            # If validation failed, stop here
            if intent.status == Status.FAILED:
                result["intent"] = intent
                result["response"] = f"Intent rejected: {intent.context}"
                return result
            
            # ==============================
            # STAGE 4: ROUTE
            # ==============================
            print("🔀 [Stage 4/5] Routing to agent...")
            worker, agent_name = self.router.route(intent)
            
            # ==============================
            # STAGE 5: EXECUTE
            # ==============================
            print(f"⚡ [Stage 5/5] Executing via {agent_name}...")
            intent.advance_status(Status.EXECUTING)
            
            response_text = worker.execute(intent)
            
            # Mark as complete
            intent.advance_status(Status.COMPLETED)
            
            # Package the result
            result["intent"] = intent
            result["response"] = response_text
            result["agent"] = agent_name
            result["success"] = True
            
            print(f"✅ [Pipeline] Complete. Status: {intent.status.name}")
            
        except Exception as e:
            print(f"❌ [Pipeline] Critical failure: {e}")
            result["response"] = f"System Error: {e}"
        
        return result