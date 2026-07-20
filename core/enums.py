from enum import Enum, auto

class TaskType(Enum):
    BUILD = auto()
    ANALYZE = auto()
    RESEARCH = auto()
    SUMMARIZE = auto()
    PLAN = auto()
    DEBUG = auto()
    EXPLAIN = auto()
    GENERATE = auto()
    TRANSLATE = auto()
    REVIEW = auto()

class Priority(Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    FAILED = 4

class Status(Enum):
    INITIALIZED = auto()
    PROCESSING = auto()
    COMPLETED = auto()
    FAILED = auto()
