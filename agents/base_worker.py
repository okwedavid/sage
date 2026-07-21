"""
agents/base_worker.py
OWNS: Abstract Base Class for all workers
EXPOSES: BaseWorker interface
FORBIDDEN: Concrete logic
"""
from abc import ABC, abstractmethod
from core.intent.schemas import IntentSchema

class BaseWorker(ABC):
    @abstractmethod
    def execute(self, intent: IntentSchema) -> str:
        pass
