"""
core/intent/schemas.py
OWNS: IntentSchema dataclass (the Passport)
EXPOSES: IntentSchema with lifecycle management
FORBIDDEN: LLM calls, routing logic
"""
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from .enums import TaskType, Priority, Status, OutputFormat

@dataclass
class IntentSchema:
    # SECTION 1: REQUIRED
    input_text: str
    
    # SECTION 2: CLASSIFICATION
    task_type: Optional[TaskType] = None
    target_domain: str = ""
    confidence_score: float = 0.0
    goal: str = ""
    
    # SECTION 3: EXTRACTED INTELLIGENCE
    entities: dict[str, Any] = field(default_factory=dict)
    constraints: dict[str, Any] = field(default_factory=dict)
    context: str = ""
    attachments: dict[str, Any] = field(default_factory=dict)
    
    # SECTION 4: EXECUTION PARAMETERS
    priority: Priority = Priority.NORMAL
    output_format: OutputFormat = OutputFormat.MARKDOWN
    suggested_agent: str = ""
    
    # SECTION 5: LIFECYCLE (IMMUTABLE after creation)
    intent_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: Status = Status.RECEIVED
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def __post_init__(self):
        if not self.input_text or not self.input_text.strip():
            raise ValueError("Intent rejected: input_text cannot be empty.")
        if not (0.0 <= self.confidence_score <= 1.0):
            raise ValueError(
                f"Intent rejected: confidence_score must be 0.0-1.0, got {self.confidence_score}"
            )
        if self.task_type is not None and not isinstance(self.task_type, TaskType):
            raise TypeError(f"task_type must be TaskType enum, got {type(self.task_type)}")
        if not isinstance(self.priority, Priority):
            raise TypeError(f"priority must be Priority enum, got {type(self.priority)}")
        if not isinstance(self.status, Status):
            raise TypeError(f"status must be Status enum, got {type(self.status)}")

    def advance_status(self, new_status: Status):
        valid_order = list(Status)
        current_index = valid_order.index(self.status)
        new_index = valid_order.index(new_status)
        if new_index <= current_index:
            raise ValueError(
                f"Cannot move from {self.status.name} to {new_status.name}. "
                f"Status can only advance forward."
            )
        self.status = new_status

    def to_dict(self) -> dict:
        return {
            "intent_id": self.intent_id,
            "input_text": self.input_text,
            "task_type": self.task_type.name if self.task_type else None,
            "target_domain": self.target_domain,
            "goal": self.goal,
            "confidence_score": self.confidence_score,
            "entities": self.entities,
            "constraints": self.constraints,
            "context": self.context,
            "has_attachments": bool(self.attachments),
            "priority": self.priority.name,
            "output_format": self.output_format.name,
            "suggested_agent": self.suggested_agent,
            "status": self.status.name,
            "created_at": self.created_at
        }

    def __repr__(self) -> str:
        return (
            f"Intent[{self.intent_id[:8]}] "
            f"type={self.task_type.name if self.task_type else 'UNCLASSIFIED'} "
            f"status={self.status.name} "
            f"priority={self.priority.name} "
            f"confidence={self.confidence_score:.0%}"
        )
