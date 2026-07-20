import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from .enums import TaskType, Priority, Status, OutputFormat


@dataclass
class IntentSchema:
    """
    The Passport of every request flowing through SAGE.
    
    OWNS:
        - Identity of the intent
        - Classification metadata
        - Lifecycle state
    
    EXPOSES:
        - Read-only access to all fields for Agents, Planners, Routers
    
    FORBIDDEN:
        - Must NEVER call APIs
        - Must NEVER render UI
        - Must NEVER execute tasks
        - Must NEVER import Groq, Streamlit, or any external service
    """
    
    # ============================================
    # SECTION 1: REQUIRED FIELDS (User Must Provide)
    # ============================================
    input_text: str  # The raw human language input
    
    # ============================================
    # SECTION 2: CLASSIFICATION (Filled by Classifier)
    # ============================================
    task_type: Optional[TaskType] = None
    target_domain: str = ""
    confidence_score: float = 0.0
    goal: str = ""              # One-sentence summary of what user wants
    
    # ============================================
    # SECTION 3: EXTRACTED INTELLIGENCE
    # ============================================
    entities: dict[str, Any] = field(default_factory=dict)
    constraints: dict[str, Any] = field(default_factory=dict)  # e.g., {"max_length": 500, "language": "French"}
    context: str = ""           # Additional background info
    
    # ============================================
    # SECTION 4: EXECUTION PARAMETERS
    # ============================================
    priority: Priority = Priority.NORMAL
    output_format: OutputFormat = OutputFormat.MARKDOWN  # Default to markdown
    suggested_agent: str = ""
    
    # ============================================
    # SECTION 5: LIFECYCLE (Auto-Generated, IMMUTABLE)
    # ============================================
    intent_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: Status = Status.RECEIVED
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    
    # ============================================
    # VALIDATION LAYER
    # ============================================
    def __post_init__(self):
        """
        Runs automatically after object creation.
        Acts as the 'Bouncer' - rejects bad data immediately.
        """
        
        # RULE 1: Input text cannot be empty
        if not self.input_text or not self.input_text.strip():
            raise ValueError("Intent rejected: input_text cannot be empty.")
        
        # RULE 2: Confidence must be between 0 and 1
        if not (0.0 <= self.confidence_score <= 1.0):
            raise ValueError(
                f"Intent rejected: confidence_score must be 0.0-1.0, got {self.confidence_score}"
            )
        
        # RULE 3: Ensure enums are actual Enum types (not raw strings)
        if self.task_type is not None and not isinstance(self.task_type, TaskType):
            raise TypeError(
                f"Intent rejected: task_type must be a TaskType enum, got {type(self.task_type)}"
            )
        
        if not isinstance(self.priority, Priority):
            raise TypeError(
                f"Intent rejected: priority must be a Priority enum, got {type(self.priority)}"
            )
        
        if not isinstance(self.status, Status):
            raise TypeError(
                f"Intent rejected: status must be a Status enum, got {type(self.status)}"
            )
    
    # ============================================
    # LIFECYCLE METHODS
    # ============================================
    def advance_status(self, new_status: Status):
        """
        Moves the intent to the next stage.
        Enforces that status can only move FORWARD, never backward.
        """
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
        """
        Serializes the Intent into a plain dictionary.
        Useful for JSON export, logging, and database storage.
        """
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
            "priority": self.priority.name,
            "output_format": self.output_format.name,
            "suggested_agent": self.suggested_agent,
            "status": self.status.name,
            "created_at": self.created_at
        }
    
    def __repr__(self) -> str:
        """
        Custom string representation for debugging.
        When you print(intent), you see a clean summary instead of garbage.
        """
        return (
            f"Intent[{self.intent_id[:8]}] "
            f"type={self.task_type.name if self.task_type else 'UNCLASSIFIED'} "
            f"status={self.status.name} "
            f"priority={self.priority.name} "
            f"confidence={self.confidence_score:.0%}"
        )