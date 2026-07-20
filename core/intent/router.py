from .schemas import IntentSchema
from .enums import Status


class IntentRouter:
    """
    OWNS: The decision of WHICH agent handles a given intent.
    EXPOSES: route() method.
    FORBIDDEN: Must never execute the task itself.
    """
    
    def __init__(self, registry):
        """
        Receives the AgentRegistry (the Phone Book) at boot time.
        """
        self.registry = registry
    
    def route(self, intent: IntentSchema) -> tuple:
        """
        Takes a validated IntentSchema and returns:
            (worker_instance, worker_name)
        
        Also advances the intent status to ROUTED.
        """
        
        # Safety check: Only route validated intents
        if intent.status != Status.VALIDATED:
            raise ValueError(
                f"Cannot route intent with status '{intent.status.name}'. "
                f"Expected: VALIDATED"
            )
        
        # Ask the Registry: "Who handles this?"
        worker, worker_name = self.registry.lookup(
            task_type=intent.task_type,
            output_format=intent.output_format
        )
        
        # Update the intent metadata
        intent.suggested_agent = worker_name
        intent.advance_status(Status.ROUTED)
        
        print(f"🔀 [Router] Routed to: {worker_name}")
        
        return worker, worker_name