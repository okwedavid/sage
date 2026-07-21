from .schemas import IntentSchema
from .enums import Status


class IntentRouter:
    """
    OWNS: The decision of WHICH agent handles a given intent.
    EXPOSES: route() method.
    FORBIDDEN: Must never execute the task itself.
    """
    
    def __init__(self, registry):
        self.registry = registry
    
    def route(self, intent: IntentSchema) -> tuple:
        """
        Takes a validated IntentSchema and returns:
            (worker_instance, worker_name)
        
        Routing Priority:
            1. Image attachment → VisionWorker
            2. Normal registry lookup by task_type + output_format
        """
        
        if intent.status != Status.VALIDATED:
            raise ValueError(
                f"Cannot route intent with status '{intent.status.name}'. "
                f"Expected: VALIDATED"
            )
        
        # --- PRIORITY 1: Check for image attachments ---
        if intent.attachments.get("image_base64"):
            worker = self.registry._workers.get("VisionWorker")
            if worker:
                intent.suggested_agent = "VisionWorker"
                intent.advance_status(Status.ROUTED)
                print(f"🔀 [Router] Image detected → Routed to: VisionWorker")
                return worker, "VisionWorker"
            else:
                print("⚠️ [Router] Image found but no VisionWorker registered. Falling back.")
        
        # --- PRIORITY 2: Normal routing ---
        worker, worker_name = self.registry.lookup(
            task_type=intent.task_type,
            output_format=intent.output_format
        )
        
        intent.suggested_agent = worker_name
        intent.advance_status(Status.ROUTED)
        
        print(f"🔀 [Router] Routed to: {worker_name}")
        
        return worker, worker_name