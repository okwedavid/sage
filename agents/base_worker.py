from abc import ABC, abstractmethod
# We import from the sibling 'core' directory relative to root
from core.intent.schemas import IntentSchema

class BaseWorker(ABC):
    """
    The Abstract Parent.
    All specific workers (Researcher, Coder) must inherit from this.
    """
    
    @abstractmethod
    def execute(self, intent: IntentSchema) -> str:
        pass