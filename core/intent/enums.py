from enum import Enum, auto


class TaskType(Enum):
    """
    OWNS: The canonical list of cognitive operations SAGE can perform.
    EXPOSES: Task categories to Classifier, Router, and Agents.
    FORBIDDEN: Must never contain implementation logic or API calls.
    """
    BUILD       = auto()
    ANALYZE     = auto()
    RESEARCH    = auto()
    SUMMARIZE   = auto()
    PLAN        = auto()
    DEBUG       = auto()
    EXPLAIN     = auto()
    GENERATE    = auto()
    TRANSLATE   = auto()
    REVIEW      = auto()


class Priority(Enum):
    """
    Urgency levels. Agents may use this to allocate resources differently.
    Example: CRITICAL tasks skip the queue in future versions.
    """
    LOW      = 1
    NORMAL   = 2
    HIGH     = 3
    CRITICAL = 4


class Status(Enum):
    """
    The Lifecycle of an Intent.
    
    Valid Transitions:
        RECEIVED → VALIDATED → ROUTED → EXECUTING → COMPLETED
                                                   → FAILED
    
    An Intent can only move FORWARD through these stages, never backward.
    """
    RECEIVED   = auto()
    VALIDATED  = auto()
    ROUTED     = auto()
    EXECUTING  = auto()
    COMPLETED  = auto()
    FAILED     = auto()


class OutputFormat(Enum):
    """
    NEW: Defines what FORMAT the final output should take.
    This is what enables future Image/Video/Code agents.
    The Router will read this field to decide WHICH worker to call.
    """
    TEXT     = auto()
    MARKDOWN = auto()
    JSON     = auto()
    PYTHON   = auto()
    HTML     = auto()
    PDF      = auto()
    IMAGE    = auto()   # Future: Route to Stability AI / DALL-E
    VIDEO    = auto()   # Future: Route to Runway ML