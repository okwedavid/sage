"""
core/intent/enums.py
OWNS: All enum definitions (TaskType, Priority, Status, OutputFormat)
EXPOSES: Enum classes
FORBIDDEN: Business logic, LLM calls
"""
from enum import Enum, auto

class TaskType(Enum):
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
    LOW      = 1
    NORMAL   = 2
    HIGH     = 3
    CRITICAL = 4

class Status(Enum):
    RECEIVED   = auto()
    VALIDATED  = auto()
    ROUTED     = auto()
    EXECUTING  = auto()
    COMPLETED  = auto()
    FAILED     = auto()

class OutputFormat(Enum):
    TEXT     = auto()
    MARKDOWN = auto()
    JSON     = auto()
    PYTHON   = auto()
    HTML     = auto()
    PDF      = auto()
    IMAGE    = auto()
    VIDEO    = auto()
