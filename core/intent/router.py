"""
core/intent/router.py
OWNS: Routes intents to correct agent
EXPOSES: IntentRouter.route()
FORBIDDEN: Execution, LLM calls
"""
from .schemas import IntentSchema
from .enums import Status

class IntentRouter:
    def __init__(self, registry):
        self.registry = registry

    def route(self, intent: IntentSchema) -> tuple:
        if intent.status != Status.VALIDATED:
            raise ValueError(
                f"Cannot route '{intent.status.name}'. Expected: VALIDATED"
            )
        
        # Priority 1: Image attachments → VisionWorker
        if intent.attachments.get("image_base64"):
            worker = self.registry._workers.get("VisionWorker")
            if worker:
                intent.suggested_agent = "VisionWorker"
                intent.advance_status(Status.ROUTED)
                print(f"🔀 [Router] Image → VisionWorker")
                return worker, "VisionWorker"
        
        # Priority 2: Normal routing
        worker, name = self.registry.lookup(
            task_type=intent.task_type,
            output_format=intent.output_format
        )
        intent.suggested_agent = name
        intent.advance_status(Status.ROUTED)
        print(f"🔀 [Router] → {name}")
        return worker, name
