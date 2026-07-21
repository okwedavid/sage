# ════════════════════════════════════════════════════════════════════════
# SAGE — COMPLETE AGENT HANDOFF DOCUMENT
# ════════════════════════════════════════════════════════════════════════
# 
# This document contains the FULL context of the SAGE project. 
# Any AI agent, LLM, or human developer should be able to read this 
# document and continue development seamlessly.
#
# Last Updated: Sprint 6 Complete
# Author: gamp (Beginner Builder → Systems Architect trajectory)
# ════════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────
# SECTION 1: IDENTITY & VISION
# ─────────────────────────────────────────

## What is SAGE?

SAGE (Systemic Agentic General Engine) is an **AI Cognitive Operating System**.

It is NOT a chatbot.
It is NOT a wrapper around an LLM API.
It is NOT tied to any single programming language.

SAGE is a modular, agentic framework that separates **Interpretation** from
**Execution**. Every user request flows through a structured pipeline before
any AI model is consulted. The LLM is a **worker** inside the system — not
the architect.

### The Core Principle

Most AI applications do this:

    User Input → LLM → Answer

SAGE does this:

    User Input → Normalize → Classify → Validate → Route → Execute → Validate → Respond

This separation makes the system:
- **Testable** — Each stage can be verified independently
- **Scalable** — New agents plug in without rewriting existing code
- **Observable** — You can see exactly what happened at every stage
- **Language-agnostic** — The pipeline contracts are not Python-specific

### The Long-Term Vision

SAGE will evolve into a user's automated cognitive operating system that can:
- Accept text, images, voice, video, and file uploads
- Read and analyze any URL on the internet
- Generate images, documents, reports, and code
- Connect to external platforms (GitHub, Slack, email, calendars)
- Maintain conversation memory and context across sessions
- Orchestrate multiple specialized AI agents simultaneously
- Export results as PDFs, CSVs, or structured data
- Serve as a personal AI assistant accessible from anywhere

### Design Philosophy

The interface should feel like a **Mission Control Center**, not a chat window.

Inspiration references:
- Raycast (speed, keyboard-first)
- Linear (clean, purposeful design)
- Arc Browser (spatial organization)
- Cursor IDE (inline AI integration)
- Vercel Dashboard (system monitoring)
- Notion AI (workspace-centric)
- Apple VisionOS (immersive, spatial)


# ─────────────────────────────────────────
# SECTION 2: DEVELOPER PROFILE
# ─────────────────────────────────────────

## Who is the developer?

- **Name**: gamp
- **Level**: Began as absolute Python beginner, now intermediate
- **Learning Style**:
  - Line-by-line code explanations
  - Architecture-first thinking
  - Production-quality patterns (not tutorials)
  - Real terminal commands (Ubuntu Linux)
- **Preferences**:
  - Modular code with clear ownership
  - Every file answers: What does it own? What does it expose? What is it forbidden from doing?
  - Single Responsibility Principle at the module level
  - Domain-Driven Design
  - Forward-only lifecycle management


# ─────────────────────────────────────────
# SECTION 3: ENVIRONMENT & INFRASTRUCTURE
# ─────────────────────────────────────────

## Hardware
- **OS**: Ubuntu Linux (Debian-based)
- **RAM**: 8GB (resource-conscious decisions required)
- **Editor**: VS Code

## Software Stack
- **Python**: 3.12
- **Virtual Environment**: `/home/gamp/sage/.venv`
- **Activation**: `source .venv/bin/activate`
- **Package Manager**: pip

## Key Commands
- Run CLI interface: `python3 run_sage.py`
- Run Web UI: `streamlit run app.py`
- Run offline tests: `python3 main.py`
- Update dependencies: `pip freeze > requirements.txt`

## External Services
- **LLM Provider**: Groq (ultra-fast inference cloud)
  - Text Model: `llama-3.3-70b-versatile`
  - Vision Model: `llama-3.2-11b-vision-preview`
  - Speech-to-Text: `whisper-large-v3`
  - API Key format: `gsk_...`
  - Console: https://console.groq.com
- **Text-to-Speech**: Google TTS (gTTS) — free, no API key needed
- **Hosting**: Streamlit Community Cloud (free tier)
  - Deployed URL: [user's streamlit.app URL]
  - Secrets configured via Streamlit Cloud dashboard

## Installed Python Packages
- streamlit
- groq
- python-dotenv
- gTTS
- Pillow
- requests
- beautifulsoup4

## Important Rules
- NEVER run files inside `core/` directly — always run from root
- NEVER hardcode API keys in source files
- NEVER commit `.env` to Git
- Always activate `.venv` before running any commands
- When Groq decommissions a model, update ONLY the model string in config


# ─────────────────────────────────────────
# SECTION 4: COMPLETED SPRINT HISTORY
# ─────────────────────────────────────────

### Sprint 1 — Foundation (Intent Engine Infrastructure)
- Created the Intent Package `core/intent/`)
- Defined Enums: TaskType, Priority, Status
- Built IntentSchema using Python dataclasses
- Created the entry point `run_sage.py`)
- Tested offline schema creation `main.py`)
- Learned: Variables, f-strings, imports, classes, print()

### Sprint 2 — Domain Model Hardening
- Rebuilt `enums.py` with OutputFormat enum (TEXT, IMAGE, VIDEO, PDF, etc.)
- Rebuilt `schemas.py` with full lifecycle management:
  - UUID-based intent_id (immutable after creation)
  - Auto-generated UTC timestamps
  - Confidence validation (0.0–1.0 range)
  - Forward-only status advancement (RECEIVED → VALIDATED → ROUTED → EXECUTING → COMPLETED)
  - Serialization via to_dict()
  - Custom **repr** for debugging
  - Type validation in __post_init__
- Tested backward status rejection (correctly raises ValueError)
- Learned: Dataclasses, Enums, validation, type hints, Optional

### Sprint 3 — The Nervous System (Router + Pipeline)
- Built IntentNormalizer: emoji removal, whitespace collapse, punctuation reduction, lowercasing
- Built IntentValidator: confidence threshold checks, field presence validation
- Built AgentRegistry: plugin architecture with lookup() method
- Built IntentRouter: routes validated intents to correct agent based on task_type + output_format
- Built IntentPipeline: orchestrates all 5 stages (Normalize → Classify → Validate → Route → Execute)
- Connected everything via run_sage.py interactive CLI loop
- Fixed lifecycle bug: Classifier was setting status=VALIDATED instead of RECEIVED
- Learned: ABC (Abstract Base Classes), try/except, method chaining, dictionaries

### Sprint 3.5 — Professional UI + Security
- Created `config/settings.py` with python-dotenv for secure config loading
- Created `.env` file for API key storage
- Created `.gitignore` to protect secrets
- Built first version of `app.py` with Streamlit:
  - Chat interface with session state
  - Sidebar with API key input, model selection
  - Intent metadata tags on responses
  - @st.cache_resource for pipeline boot optimization

### Sprint 4 — Web Intelligence + Bug Fixes
- Fixed API key 401 error (whitespace stripping + format validation with startswith("gsk_"))
- Removed @st.cache_resource (caused stale key caching when user changed keys)
- Created WebWorker agent:
  - URL extraction via regex
  - Web page fetching via requests library
  - HTML parsing via BeautifulSoup (strips scripts, styles, nav, footer)
  - Content truncation to 3000 chars (LLM context protection)
  - Fallback to general assistant if no URL found
- Updated Classifier to auto-detect URLs and override task_type to RESEARCH
- Added copy-to-clipboard via st.code() expander
- Added "Quick Start Guide" expander for new users
- Added session stats (query count, success rate)
- Added Reboot button for engine re-initialization
- Registered WebWorker in both app.py and run_sage.py

### Sprint 5 — Multimodal Intelligence
- Created VisionWorker agent:
  - Accepts base64-encoded images via intent.attachments
  - Sends multimodal messages to Groq vision model
  - Falls back to text if no image attached
- Created AudioService:
  - Speech-to-Text via Groq Whisper (transcribe method)
  - Text-to-Speech via gTTS (synthesize method)
  - Markdown stripping for cleaner speech output
  - Text truncation to 3000 chars for TTS
  - Memory-only processing (io.BytesIO, no disk writes)
- Added `attachments` field to IntentSchema (dict for binary data)
- Updated Pipeline.process() to accept optional attachments parameter
- Updated Router with Priority 1: image attachment → VisionWorker override
- Updated app.py with image upload, voice recording, voice playback
- Added TTS toggle in sidebar
- Added auto-TTS on new responses
- Updated config/settings.py with VISION_MODEL, WHISPER_MODEL, TTS settings

### Sprint 6 — UI Architecture Refactor (CURRENT)
- Decomposed monolithic app.py (750+ lines) into modular UI framework
- Created 15 separate UI files with clear ownership boundaries
- app.py reduced to ~60 lines (pure orchestration)
- Created:
  - ui/styles/palette.py — Every color constant
  - ui/styles/theme.py — Page configuration
  - ui/styles/css.py — Complete CSS stylesheet injection
  - ui/state.py — All session state management
  - ui/boot.py — Engine initialization logic
  - ui/components/sidebar.py — Left navigation panel
  - ui/components/chat_panel.py — Chat history rendering
  - ui/components/intent_card.py — Horizontal metadata table
  - ui/components/response_card.py — Response body + action bar (Copy, Listen, Save)
  - ui/components/inspector.py — Right-panel intelligence display
  - ui/components/attachment_panel.py — Image upload + voice recording
  - ui/components/composer.py — Universal text input handler
  - ui/components/pipeline_viz.py — Live execution timeline with st.status()
  - ui/layouts/workspace.py — 3-column layout composition
  - app.py — Pure orchestrator (theme → css → state → sidebar → workspace)


# ─────────────────────────────────────────
# SECTION 5: BUGS ENCOUNTERED & FIXED
# ─────────────────────────────────────────

1.  `ModuleNotFoundError: streamlit` 
    → Virtual environment not activated. Fix: source .venv/bin/activate

2.  `externally-managed-environment` (pip install blocked by OS)
    → Created venv: python3 -m venv .venv

3.  Model `llama3-70b-8192` decommissioned by Groq
    → Updated model string to `llama-3.3-70b-versatile`

4.  Model `gpt-oss-20b` not found
    → Typo in model string, corrected

5.  Model `gemma2-9b-it` decommissioned
    → Fell back to `llama-3.3-70b-versatile`

6.  `RuntimeWarning: found in sys.modules after import`
    → Cleaned __init__.py files, created dedicated run_sage.py entry point

7.  `ImportError: attempted relative import with no known parent package`
    → Was running classifier.py directly instead of from root via run_sage.py

8.  `ModuleNotFoundError: agents.general_worker`
    → File was missing from agents/ directory, created it

9.  `Cannot move from VALIDATED to VALIDATED`
    → Classifier was overstepping authority by setting status=VALIDATED
    → Fixed: Classifier now sets status=RECEIVED (its job is to fill fields, not validate them)

10. `NameError: roi not defined`
    → Variable calculated inside a column scope, not accessible outside
    → Fixed: Recalculated in global scope before export section

11. `Error 401: Invalid API Key`
    → Invisible whitespace characters in pasted key
    → Fixed: Added .strip() and format validation (must start with "gsk_")

12. Stale pipeline after key change
    → @st.cache_resource cached the first boot and ignored new keys
    → Fixed: Removed cache decorator, boot managed via session_state comparison


# ─────────────────────────────────────────
# SECTION 6: ARCHITECTURE PRINCIPLES
# ─────────────────────────────────────────

1.  **Single Responsibility**: Each file owns ONE thing
2.  **Domain-Driven Design**: Code organized around bounded contexts (Intent, Agents, UI)
3.  **Separation of Interpretation and Execution**: Understanding ≠ Doing
4.  **Forward-only Lifecycle**: Status can never go backward (RECEIVED → COMPLETED)
5.  **Plugin Architecture**: New agents = register in registry, don't rewrite existing code
6.  **The LLM is a Worker**: It sits at the bottom of the execution chain, not the top
7.  **Ownership Boundaries**: Every module declares what it OWNS, EXPOSES, and is FORBIDDEN from
8.  **Language Agnostic Contracts**: The pipeline design (Normalize → Classify → Validate → Route → Execute) is not Python-specific. It could be reimplemented in TypeScript, Go, Rust, or any language.
9.  **Security First**: API keys in .env, never in source code, .gitignore protects secrets
10. **Resource Consciousness**: All decisions consider 8GB RAM constraint


# ─────────────────────────────────────────
# SECTION 7: COMPLETE FILE TREE
# ─────────────────────────────────────────

```text
sage/
├── .env                          # Secret API keys (NEVER commit)
├── .env.example                  # Template for other developers (safe for Git)
├── .gitignore                    # Blocks .env, __pycache__, .venv
├── app.py                        # Streamlit entry point (~60 lines, pure orchestration)
├── run_sage.py                   # CLI interactive interface
├── main.py                       # Offline test suite / unit tests
├── README.md                     # Project documentation
├── requirements.txt              # Python dependencies
├── SAGE_AGENT_HANDOFF.md         # THIS FILE
│
├── config/
│   ├── __init__.py
│   └── settings.py               # Central config loader (.env → Python)
│
├── core/
│   ├── __init__.py
│   └── intent/
│       ├── __init__.py
│       ├── enums.py               # TaskType, Priority, Status, OutputFormat
│       ├── schemas.py             # IntentSchema dataclass (the Passport)
│       ├── normalizer.py          # Text cleaning before classification
│       ├── classifier.py          # Groq LLM-based intent classification
│       ├── validator.py           # Post-classification quality assurance
│       ├── router.py              # Routes intents to correct agent
│       └── pipeline.py            # Orchestrates all 5 stages sequentially
│
├── agents/
│   ├── __init__.py
│   ├── registry.py                # Plugin-based agent phone book
│   ├── base_worker.py             # Abstract Base Class for all workers
│   ├── general_worker.py          # Text-based LLM worker (Groq)
│   ├── web_worker.py              # URL fetching + web analysis worker
│   └── vision_worker.py           # Image analysis via multimodal LLM
│
├── services/
│   ├── __init__.py
│   └── audio_service.py           # Speech-to-Text (Whisper) + Text-to-Speech (gTTS)
│
├── ui/
│   ├── __init__.py
│   ├── state.py                   # Session state manager
│   ├── boot.py                    # Engine initialization
│   ├── components/
│   │   ├── __init__.py
│   │   ├── sidebar.py             # Left navigation panel
│   │   ├── chat_panel.py          # Chat history rendering
│   │   ├── intent_card.py         # Horizontal metadata table
│   │   ├── response_card.py       # Response + action bar (Copy/Listen/Save)
│   │   ├── inspector.py           # Right-panel intelligence display
│   │   ├── attachment_panel.py    # Image upload + voice recording
│   │   ├── composer.py            # Universal text input handler
│   │   └── pipeline_viz.py        # Live execution timeline
│   ├── layouts/
│   │   ├── __init__.py
│   │   └── workspace.py           # Main 3-column layout
│   └── styles/
│       ├── __init__.py
│       ├── palette.py             # Color constants
│       ├── theme.py               # Page configuration
│       └── css.py                 # Complete CSS injection
│
├── memory/                        # EMPTY — Future: conversation memory / RAG
├── models/                        # EMPTY — Future: custom ML models
├── reports/                       # EMPTY — Future: PDF/HTML report generation
├── storage/                       # EMPTY — Future: file/database storage
├── utils/                         # EMPTY — Future: shared helper functions
└── assets/                        # EMPTY — Future: images, icons, static files
```


# ─────────────────────────────────────────
# SECTION 8: COMPLETE FILE CONTENTS
# ─────────────────────────────────────────

## `.env`
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
SAGE_DEFAULT_MODEL=llama-3.3-70b-versatile
SAGE_VISION_MODEL=llama-3.2-11b-vision-preview
SAGE_WHISPER_MODEL=whisper-large-v3
```

## `.env.example`
```env
GROQ_API_KEY=your_key_here
SAGE_DEFAULT_MODEL=llama-3.3-70b-versatile
SAGE_VISION_MODEL=llama-3.2-11b-vision-preview
SAGE_WHISPER_MODEL=whisper-large-v3
```

## `.gitignore`
```
.env
__pycache__/
.venv/
*.pyc
```

## `config/settings.py`
```python
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    DEFAULT_MODEL: str = os.getenv("SAGE_DEFAULT_MODEL", "llama-3.3-70b-versatile")
    VISION_MODEL: str = os.getenv("SAGE_VISION_MODEL", "llama-3.2-11b-vision-preview")
    WHISPER_MODEL: str = os.getenv("SAGE_WHISPER_MODEL", "whisper-large-v3")
    
    APP_NAME: str = "SAGE"
    APP_VERSION: str = "6.0"
    APP_TAGLINE: str = "Systemic Agentic General Engine"
    
    CONFIDENCE_THRESHOLD: float = 0.4
    MAX_TOKENS: int = 1024
    VISION_MAX_TOKENS: int = 1500
    
    TTS_LANGUAGE: str = "en"
    TTS_ENABLED: bool = True
    MAX_IMAGE_SIZE_MB: int = 4

    @classmethod
    def validate(cls) -> bool:
        if not cls.GROQ_API_KEY:
            return False
        return True

    @classmethod
    def get_masked_key(cls) -> str:
        key = cls.GROQ_API_KEY
        if len(key) > 8:
            return f"{key[:6]}...{key[-4:]}"
        return "NOT SET"
```

## `core/intent/enums.py`
```python
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
```

## `core/intent/schemas.py`
```python
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
    
    # SECTION 5: LIFECYCLE (IMMUTABLE)
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
```

## `core/intent/normalizer.py`
```python
import re


class IntentNormalizer:
    def normalize(self, raw_text: str) -> str:
        if not raw_text:
            raise ValueError("Normalizer received empty input.")
        text = raw_text.strip()
        text = re.sub(r'\s+', ' ', text)
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"
            "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF"
            "\U0001F1E0-\U0001F1FF"
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub('', text).strip()
        text = re.sub(r'([!?.])\1+', r'\1', text)
        text = text.lower()
        return text
```

## `core/intent/classifier.py`
```python
import json
import re
from groq import Groq
from .schemas import IntentSchema
from .enums import TaskType, Priority, Status, OutputFormat


class IntentClassifier:
    def __init__(self, api_key):
        self.client = Groq(api_key=api_key)
        self.system_prompt = """
You are SAGE-Classifier, a highly precise intent recognition engine.
Your ONLY job is to analyze user input and convert it into structured JSON.

CRITICAL RULES:
1. Identify the PRIMARY intent.
2. Classify the DOMAIN (e.g., Coding, Networking, Finance, Creative Writing, Web).
3. Assign PRIORITY based on urgency words (e.g., "fix", "emergency", "help").
4. If the input contains a URL/link, set task_type to "RESEARCH" or "ANALYZE".
5. Return EXACTLY valid JSON, nothing else.
6. Do not solve the task. Only classify it.

AVAILABLE TASK_TYPES: [BUILD, ANALYZE, RESEARCH, SUMMARIZE, PLAN, DEBUG, EXPLAIN, GENERATE, TRANSLATE, REVIEW]
AVAILABLE PRIORITIES: [LOW, NORMAL, HIGH, CRITICAL]

JSON FORMAT:
{
    "task_type": "DEBUG",
    "target_domain": "Python",
    "confidence_score": 0.95,
    "priority": "HIGH",
    "entities": {},
    "summary": "One sentence summary."
}
"""

    def _contains_url(self, text: str) -> bool:
        return bool(re.search(r'https?://[^\s]+', text, re.IGNORECASE))

    def classify(self, text_input: str) -> IntentSchema:
        print("🤖 Consulting SAGE Neural Interface...")
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Classify this intent:\n\n{text_input}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=200
            )
            data = json.loads(response.choices[0].message.content)
            
            task_type_str = data.get("task_type", "REVIEW").upper()
            if self._contains_url(text_input) and task_type_str not in ["RESEARCH", "ANALYZE"]:
                task_type_str = "RESEARCH"
                data["target_domain"] = "Web"
            
            return IntentSchema(
                input_text=text_input,
                task_type=TaskType[task_type_str],
                target_domain=data.get("target_domain", "General"),
                confidence_score=float(data.get("confidence_score", 0.5)),
                goal=data.get("summary", ""),
                priority=Priority[data.get("priority", "NORMAL").upper()],
                entities=data.get("entities", {}),
                status=Status.RECEIVED,
                output_format=OutputFormat.MARKDOWN
            )
        except KeyError as e:
            raise ValueError(f"Unknown task type from AI: {e}")
        except Exception as e:
            raise RuntimeError(f"Neural Interface Error: {e}")
```

## `core/intent/validator.py`
```python
from .schemas import IntentSchema
from .enums import Status


class IntentValidator:
    CONFIDENCE_THRESHOLD = 0.4

    def validate(self, intent: IntentSchema) -> IntentSchema:
        errors = []
        if intent.task_type is None:
            errors.append("No task_type assigned.")
        if intent.confidence_score < self.CONFIDENCE_THRESHOLD:
            errors.append(
                f"Confidence too low: {intent.confidence_score:.0%} "
                f"(min: {self.CONFIDENCE_THRESHOLD:.0%})"
            )
        if not intent.target_domain or not intent.target_domain.strip():
            errors.append("No target_domain identified.")
        
        if errors:
            print(f"❌ [Validator] REJECTED: {errors}")
            intent.advance_status(Status.FAILED)
            intent.context = f"Validation failed: {'; '.join(errors)}"
        else:
            print(f"✅ [Validator] APPROVED ({intent.confidence_score:.0%})")
            intent.advance_status(Status.VALIDATED)
        return intent
```

## `core/intent/router.py`
```python
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
```

## `core/intent/pipeline.py`
```python
from .normalizer import IntentNormalizer
from .classifier import IntentClassifier
from .validator import IntentValidator
from .router import IntentRouter
from .enums import Status


class IntentPipeline:
    def __init__(self, api_key: str, registry):
        self.normalizer = IntentNormalizer()
        self.classifier = IntentClassifier(api_key=api_key)
        self.validator  = IntentValidator()
        self.router     = IntentRouter(registry=registry)
        print("✅ [Pipeline] All subsystems initialized.")

    def process(self, raw_input: str, attachments: dict = None) -> dict:
        if attachments is None:
            attachments = {}
        
        result = {"intent": None, "response": None, "agent": None, "success": False}
        
        try:
            print("\n📝 [Stage 1/5] Normalizing...")
            clean = self.normalizer.normalize(raw_input)
            print(f"   → \"{clean[:60]}...\"")

            print("🧠 [Stage 2/5] Classifying...")
            intent = self.classifier.classify(clean)
            print(f"   → {intent.task_type.name} ({intent.confidence_score:.0%})")

            if attachments:
                intent.attachments = attachments
                print(f"   📎 Attachments: {list(attachments.keys())}")

            print("🔍 [Stage 3/5] Validating...")
            intent = self.validator.validate(intent)
            if intent.status == Status.FAILED:
                result["intent"] = intent
                result["response"] = f"Rejected: {intent.context}"
                return result

            print("🔀 [Stage 4/5] Routing...")
            worker, agent_name = self.router.route(intent)

            print(f"⚡ [Stage 5/5] Executing via {agent_name}...")
            intent.advance_status(Status.EXECUTING)
            response_text = worker.execute(intent)
            intent.advance_status(Status.COMPLETED)

            result.update({
                "intent": intent,
                "response": response_text,
                "agent": agent_name,
                "success": True
            })
            print(f"✅ [Pipeline] Complete: {intent.status.name}")

        except Exception as e:
            print(f"❌ [Pipeline] Failed: {e}")
            result["response"] = f"System Error: {e}"
        
        return result
```

## `agents/registry.py`
```python
from core.intent.enums import TaskType, OutputFormat


class AgentRegistry:
    def __init__(self):
        self._registry = {
            OutputFormat.TEXT: {"default": "GeneralWorker"},
            OutputFormat.MARKDOWN: {
                TaskType.RESEARCH: "WebWorker",
                TaskType.ANALYZE: "WebWorker",
                "default": "GeneralWorker"
            },
            OutputFormat.PYTHON: {
                TaskType.BUILD: "GeneralWorker",
                TaskType.DEBUG: "GeneralWorker",
                "default": "GeneralWorker"
            },
            OutputFormat.IMAGE: {"default": "ImageWorker"},
            OutputFormat.VIDEO: {"default": "VideoWorker"},
            OutputFormat.PDF: {"default": "ReportWorker"},
            OutputFormat.JSON: {"default": "GeneralWorker"},
            OutputFormat.HTML: {"default": "GeneralWorker"},
        }
        self._workers = {}

    def register_worker(self, name: str, worker_instance):
        self._workers[name] = worker_instance
        print(f"   📦 Registered: {name}")

    def lookup(self, task_type: TaskType, output_format: OutputFormat):
        fmt_reg = self._registry.get(output_format, {})
        worker_name = fmt_reg.get(task_type) or fmt_reg.get("default", "GeneralWorker")
        worker = self._workers.get(worker_name)
        if not worker:
            worker = self._workers.get("GeneralWorker")
            worker_name = "GeneralWorker"
            if not worker:
                raise RuntimeError(f"No workers available: {list(self._workers.keys())}")
        return worker, worker_name
```

## `agents/base_worker.py`
```python
from abc import ABC, abstractmethod
from core.intent.schemas import IntentSchema


class BaseWorker(ABC):
    @abstractmethod
    def execute(self, intent: IntentSchema) -> str:
        pass
```

## `agents/general_worker.py`
```python
from groq import Groq
from agents.base_worker import BaseWorker
from core.intent.schemas import IntentSchema
from core.intent.enums import TaskType


class GeneralWorker(BaseWorker):
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)

    def execute(self, intent: IntentSchema) -> str:
        print(f"🔨 [GeneralWorker] {intent.task_type.name}")
        
        roles = {
            TaskType.RESEARCH: "You are a deep researcher. Provide structured, factual reports.",
            TaskType.EXPLAIN: "You are an expert teacher. Explain clearly.",
            TaskType.DEBUG: "You are a senior developer. Diagnose errors and provide corrected code.",
            TaskType.GENERATE: "You are a creative writer. Generate high-quality text.",
            TaskType.ANALYZE: "You are a critical analyst. Break down pros/cons.",
            TaskType.SUMMARIZE: "You are a summarization expert. Be concise and complete.",
            TaskType.BUILD: "You are a software engineer. Write clean, production-quality code.",
            TaskType.PLAN: "You are a strategic planner. Create actionable step-by-step plans.",
            TaskType.TRANSLATE: "You are a professional translator. Preserve meaning and tone.",
            TaskType.REVIEW: "You are a helpful assistant. Respond naturally and helpfully.",
        }
        role = roles.get(intent.task_type, "You are a helpful assistant.")
        
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": role},
                    {"role": "user", "content": f"Domain: {intent.target_domain}\n\nRequest: {intent.input_text}"}
                ],
                temperature=0.7,
                max_tokens=1024
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"[GeneralWorker ERROR] {e}"
```

## `agents/web_worker.py`
```python
import re
import requests
from bs4 import BeautifulSoup
from groq import Groq
from agents.base_worker import BaseWorker
from core.intent.schemas import IntentSchema


class WebWorker(BaseWorker):
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        self.headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}

    def _extract_urls(self, text: str) -> list:
        return re.findall(r'https?://[^\s<>"\')\]]+', text, re.IGNORECASE)

    def _fetch_page(self, url: str) -> str:
        try:
            resp = requests.get(url, headers=self.headers, timeout=10)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'html.parser')
            for el in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'iframe']):
                el.decompose()
            text = soup.get_text(separator='\n', strip=True)
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            return '\n'.join(lines)[:3000]
        except Exception as e:
            return f"[ERROR] {e}"

    def execute(self, intent: IntentSchema) -> str:
        urls = self._extract_urls(intent.input_text)
        if not urls:
            return self._fallback(intent)
        
        url = urls[0]
        print(f"🌐 [WebWorker] Fetching: {url}")
        content = self._fetch_page(url)
        if content.startswith("[ERROR]"):
            return content
        
        try:
            resp = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are SAGE-WebAnalyst. Analyze web content and answer questions. Cite specifics."},
                    {"role": "user", "content": f"QUESTION: {intent.input_text}\n\nSOURCE: {url}\n\nCONTENT:\n{content}"}
                ],
                temperature=0.3,
                max_tokens=1500
            )
            answer = resp.choices[0].message.content
            return f"🌐 **Source:** [{url}]({url})\n\n---\n\n{answer}"
        except Exception as e:
            return f"[WebWorker ERROR] {e}"

    def _fallback(self, intent):
        try:
            resp = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a research assistant."},
                    {"role": "user", "content": intent.input_text}
                ],
                temperature=0.7, max_tokens=1024
            )
            return resp.choices[0].message.content
        except Exception as e:
            return f"[WebWorker ERROR] {e}"
```

## `agents/vision_worker.py`
```python
import base64
from groq import Groq
from agents.base_worker import BaseWorker
from core.intent.schemas import IntentSchema
from config.settings import Settings


class VisionWorker(BaseWorker):
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)

    def execute(self, intent: IntentSchema) -> str:
        print("👁️ [VisionWorker] Analyzing...")
        
        img_b64 = intent.attachments.get("image_base64")
        img_type = intent.attachments.get("image_type", "jpeg")
        
        if not img_b64:
            return self._fallback(intent)
        
        question = intent.input_text.strip()
        if not question or question == "[Image uploaded]":
            question = "Analyze this image in detail. Describe what you see and provide insights."
        
        try:
            resp = self.client.chat.completions.create(
                model=Settings.VISION_MODEL,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": question},
                        {"type": "image_url", "image_url": {"url": f"data:image/{img_type};base64,{img_b64}"}}
                    ]
                }],
                temperature=0.3,
                max_tokens=Settings.VISION_MAX_TOKENS
            )
            return f"👁️ **Vision Analysis**\n\n---\n\n{resp.choices[0].message.content}"
        except Exception as e:
            return f"[VisionWorker ERROR] {e}"

    def _fallback(self, intent):
        try:
            resp = self.client.chat.completions.create(
                model=Settings.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": "You assist with visual topics."},
                    {"role": "user", "content": intent.input_text}
                ],
                temperature=0.7, max_tokens=1024
            )
            return resp.choices[0].message.content
        except Exception as e:
            return f"[VisionWorker ERROR] {e}"
```

## `services/audio_service.py`
```python
import io
from groq import Groq
from gtts import gTTS
from config.settings import Settings


class AudioService:
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)

    def transcribe(self, audio_bytes: bytes, filename: str = "recording.wav") -> str:
        print("🎤 [AudioService] Transcribing...")
        try:
            result = self.client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model=Settings.WHISPER_MODEL,
                language="en"
            )
            text = result.text.strip()
            print(f"🎤 Transcribed: \"{text[:50]}...\"")
            return text
        except Exception as e:
            raise RuntimeError(f"STT failed: {e}")

    def synthesize(self, text: str, language: str = None) -> bytes:
        lang = language or Settings.TTS_LANGUAGE
        print("🔊 [AudioService] Synthesizing...")
        try:
            clean = text.replace("**","").replace("##","").replace("```","")
            clean = clean.replace("`","").replace("---","").replace("*","")
            if len(clean) > 3000:
                clean = clean[:3000] + "... truncated."
            
            tts = gTTS(text=clean, lang=lang, slow=False)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            buf.seek(0)
            audio = buf.read()
            print(f"🔊 Generated {len(audio)} bytes")
            return audio
        except Exception as e:
            raise RuntimeError(f"TTS failed: {e}")
```

## `run_sage.py`
```python
import sys, os, getpass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.intent.pipeline import IntentPipeline
from agents.registry import AgentRegistry
from agents.general_worker import GeneralWorker
from agents.web_worker import WebWorker
from agents.vision_worker import VisionWorker


def boot_system(api_key):
    print("\n🔧 SAGE Boot v6.0")
    print("-" * 40)
    reg = AgentRegistry()
    reg.register_worker("GeneralWorker", GeneralWorker(api_key=api_key))
    reg.register_worker("WebWorker", WebWorker(api_key=api_key))
    reg.register_worker("VisionWorker", VisionWorker(api_key=api_key))
    pipeline = IntentPipeline(api_key=api_key, registry=reg)
    print("-" * 40)
    print("🟢 SAGE ONLINE.\n")
    return pipeline


def main():
    print("=" * 60)
    print("    SAGE v6.0 — Cognitive Operating System")
    print("=" * 60)
    key = getpass.getpass("🔑 API Key: ")
    if not key: return
    
    pipe = boot_system(key)
    while True:
        inp = input("⌨️  > ")
        if inp.lower() in ('exit','quit','q'): break
        if not inp.strip(): continue
        
        r = pipe.process(inp)
        print("\n" + "=" * 50)
        if r["success"]:
            i = r["intent"]
            print(f"🏷️ {i.task_type.name} | 🎯 {i.target_domain} | 🤖 {r['agent']}")
            print("-" * 50)
            print(f"\n{r['response']}\n")
        else:
            print(f"⚠️ {r['response']}")
        print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
```

## `main.py` (Offline Test Suite)
```python
from core.intent.schemas import IntentSchema
from core.intent.enums import TaskType, Priority, Status, OutputFormat

if __name__ == "__main__":
    print("🧪 SAGE Domain Model Tests")
    print("=" * 50)

    print("\n📋 Test 1: Valid Intent")
    i = IntentSchema(
        input_text="Research why ping failed",
        task_type=TaskType.DEBUG,
        target_domain="Networking",
        confidence_score=0.95,
        priority=Priority.HIGH
    )
    print(f"   ✅ {i}")

    print("\n📋 Test 2: Lifecycle")
    i.advance_status(Status.VALIDATED)
    print(f"   ✅ → {i.status.name}")
    i.advance_status(Status.ROUTED)
    print(f"   ✅ → {i.status.name}")

    print("\n📋 Test 3: Backward (Should Fail)")
    try:
        i.advance_status(Status.RECEIVED)
    except ValueError as e:
        print(f"   ✅ Rejected: {e}")

    print("\n📋 Test 4: Bad Confidence (Should Fail)")
    try:
        IntentSchema(input_text="test", confidence_score=5.0)
    except ValueError as e:
        print(f"   ✅ Rejected: {e}")

    print("\n📋 Test 5: Serialization")
    print(f"   ✅ Keys: {list(i.to_dict().keys())}")

    print("\n" + "=" * 50)
    print("🏁 All Tests Passed.")
```


# ─────────────────────────────────────────
# SECTION 9: UI MODULE CONTENTS
# ─────────────────────────────────────────

## NOTE FOR AGENT:
The complete UI module files (15 files) were created in Sprint 6.
They are listed in Section 7 (File Tree).
Their complete source code was provided during the Sprint 6 implementation.
Key files and their ownership:

- `ui/styles/palette.py` → OWNS every color constant
- `ui/styles/theme.py` → OWNS page config (st.set_page_config)
- `ui/styles/css.py` → OWNS all CSS rules (single injection point)
- `ui/state.py` → OWNS all session state (init, get, set, clear, reboot)
- `ui/boot.py` → OWNS engine initialization (registry + pipeline + audio)
- `ui/components/sidebar.py` → OWNS left panel (logo, API, status, settings, profile)
- `ui/components/chat_panel.py` → OWNS chat history rendering loop
- `ui/components/intent_card.py` → OWNS horizontal metadata table HTML
- `ui/components/response_card.py` → OWNS response body + action bar (Copy/Listen/Save)
- `ui/components/inspector.py` → OWNS right-panel intelligence display
- `ui/components/attachment_panel.py` → OWNS image upload + voice recording widgets
- `ui/components/composer.py` → OWNS text input processing + pipeline execution
- `ui/components/pipeline_viz.py` → OWNS live st.status() execution timeline
- `ui/layouts/workspace.py` → OWNS 3-column layout composition
- `app.py` → OWNS orchestration ONLY (~60 lines)

If the agent needs the exact source code for any of these files,
reference the Sprint 6 implementation conversation or ask the user to
provide the current file contents.


# ─────────────────────────────────────────
# SECTION 10: TARGET UI DESIGN
# ─────────────────────────────────────────

## Design Reference

The user has provided two mockup images showing the target UI design.
These images show a premium, dark-themed interface with the following 
characteristics:

### Layout Structure
```text
┌─────────────────────────────────────────────────────────────────┐
│  SAGE                                    Engine Status  Profile │
├──────────┬───────────────────────────┬──────────────────────────┤
│          │                           │                          │
│ Left     │   Cognitive Workspace     │   Intelligence Panel     │
│ Nav      │                           │                          │
│          │   • Chat messages         │   • Intent Inspector     │
│ • Dash   │   • Intent tables         │   • Tools grid           │
│ • Convos │   • Response cards        │   • Session stats        │
│ • Agents │   • Action bars           │   • Attachments          │
│ • Memory │                           │   • Audio controls       │
│ • Tools  │                           │                          │
│ • Config │                           │                          │
│          │                           │                          │
├──────────┴───────────────────────────┴──────────────────────────┤
│  Universal Composer: [📎] [🎤] [🌐] [🎨] Ask SAGE...     [▶]  │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Characteristics
- **Theme**: Deep dark (#0a0a0f background)
- **Accent**: Purple-blue gradient (#667eea → #764ba2 → #f093fb)
- **Typography**: Inter font, 800 weight headers
- **Cards**: Subtle borders (#1e2130), rounded corners (8-12px)
- **Status colors**: Green (#3fb950) for success, Red (#f85149) for errors
- **Intent table**: Horizontal grid layout with color-coded values
- **User profile**: Avatar + name + PRO badge at sidebar bottom
- **Metadata display**: Grid-based key-value pairs (not scattered tags)
- **Action bar**: Copy | Listen | Save buttons below each response
- **Pipeline visualization**: Animated stage indicators during processing

### Key UX Principles from Mockup
1. Everything happens in the composer (file upload, voice, URL, generate)
2. Right panel updates live while SAGE processes
3. Responses are workspaces (with tabs: Summary, Sources, Export, Voice)
4. Agent execution shows animated timeline (stage dots going from gray → blue → green)
5. Chat history presented as a Timeline with timestamps and task type badges
6. Navigation feels like an IDE, not a chatbot


# ─────────────────────────────────────────
# SECTION 11: LANGUAGE-AGNOSTIC CONTRACTS
# ─────────────────────────────────────────

## IMPORTANT: SAGE is NOT Python-Only

While the current implementation is Python, the architectural contracts
are language-agnostic. Any of these modules could be reimplemented in:

- **TypeScript/Node.js** — For a full-stack web version
- **Go** — For a high-performance CLI version
- **Rust** — For an embedded/edge version
- **Swift** — For an iOS/macOS native version
- **Kotlin** — For an Android version

### The Pipeline Contract (Language-Agnostic)

```
Interface: IntentPipeline
  Method: process(raw_input: String, attachments: Map?) → Result

  Stages:
    1. Normalizer.normalize(text) → cleaned_text
    2. Classifier.classify(cleaned_text) → IntentSchema
    3. Validator.validate(intent) → IntentSchema (with updated status)
    4. Router.route(intent) → (Worker, worker_name)
    5. Worker.execute(intent) → response_string

  Result:
    - intent: IntentSchema
    - response: String
    - agent: String
    - success: Boolean
```

### The IntentSchema Contract (Language-Agnostic)

```
IntentSchema:
  Required:
    - input_text: String (non-empty)
    
  Classification (filled by Classifier):
    - task_type: Enum[BUILD|ANALYZE|RESEARCH|SUMMARIZE|PLAN|DEBUG|EXPLAIN|GENERATE|TRANSLATE|REVIEW]
    - target_domain: String
    - confidence_score: Float (0.0–1.0)
    - goal: String
    
  Intelligence:
    - entities: Map<String, Any>
    - constraints: Map<String, Any>
    - context: String
    - attachments: Map<String, Any>
    
  Execution:
    - priority: Enum[LOW|NORMAL|HIGH|CRITICAL]
    - output_format: Enum[TEXT|MARKDOWN|JSON|PYTHON|HTML|PDF|IMAGE|VIDEO]
    - suggested_agent: String
    
  Lifecycle (immutable after creation):
    - intent_id: UUID
    - status: Enum[RECEIVED|VALIDATED|ROUTED|EXECUTING|COMPLETED|FAILED]
    - created_at: ISO8601 Timestamp
    
  Constraints:
    - status can only advance forward, never backward
    - confidence_score must be 0.0–1.0
    - input_text cannot be empty
```

### The Worker Contract (Language-Agnostic)

```
Interface: Worker
  Method: execute(intent: IntentSchema) → String
    
  Rules:
    - Must accept any IntentSchema
    - Must return a string response
    - Must handle its own errors internally
    - Must never modify intent.status (pipeline owns that)
```

### The Registry Contract (Language-Agnostic)

```
Interface: AgentRegistry
  Method: register_worker(name: String, instance: Worker)
  Method: lookup(task_type: TaskType, output_format: OutputFormat) → (Worker, String)
    
  Rules:
    - If exact match not found, fall back to format default
    - If format default not found, fall back to "GeneralWorker"
    - Must never execute tasks
```


# ─────────────────────────────────────────
# SECTION 12: PENDING ROADMAP
# ─────────────────────────────────────────

### Sprint 7 — Conversation Memory
- Implement memory/ module
- Store conversation context across sessions
- RAG (Retrieval-Augmented Generation) for recalling past intents
- Memory-aware agent responses ("You asked about this last time...")

### Sprint 8 — Reports & Export
- Implement reports/ module
- PDF generation from completed intents
- HTML report templates
- CSV export for structured data
- Batch export of conversation history

### Sprint 9 — Multi-Agent Orchestration
- Planner module that breaks complex tasks into sub-intents
- Parallel agent execution
- Agent-to-agent communication
- Task dependency graphs

### Sprint 10 — Platform Connections
- GitHub integration (read/write repos, issues)
- Slack/Discord bot interface
- Email analysis and response drafting
- Calendar integration
- OAuth2 authentication framework

### Sprint 11 — Advanced Vision
- Image generation (Stability AI / DALL-E integration)
- Video generation (Runway ML integration)
- Multi-image analysis
- Document/PDF scanning (OCR)

### Sprint 12 — User System
- Authentication and user accounts
- Usage tracking and quotas
- Personal preferences and customization
- Team workspaces

### Sprint 13 — Edge Deployment
- Local LLM support (Ollama integration)
- Offline mode with reduced capabilities
- Mobile-responsive UI
- PWA (Progressive Web App) support


# ─────────────────────────────────────────
# SECTION 13: INSTRUCTIONS FOR AGENT
# ─────────────────────────────────────────

## Rules for any AI agent continuing this project:

1.  **Always explain code line-by-line** when introducing new concepts
2.  **Architecture first, implementation second** — design contracts before writing logic
3.  **Every module must declare**: What it OWNS, EXPOSES, and is FORBIDDEN from doing
4.  **Terminal commands for Ubuntu/Linux** — the developer uses Ubuntu + VS Code
5.  **8GB RAM constraint** — never suggest solutions that require >2GB per service
6.  **Single Responsibility** — one file, one job
7.  **Forward-only lifecycle** — Status enum can never go backward
8.  **Plugin architecture** — new agents = register, don't rewrite
9.  **The LLM is a worker**, not the architect — it sits at the bottom of the chain
10. **Language-agnostic thinking** — contracts should be implementable in any language
11. **Never run files inside core/ directly** — always from root via run_sage.py or app.py
12. **When models get decommissioned** — update ONLY the model string in settings.py
13. **Security first** — API keys in .env only, never in source code
14. **Test everything** — main.py is the offline test suite, run it after every change
15. **Preserve the UI mockup vision** — SAGE should feel like a Mission Control Center,
    not a chatbot. Reference the design in Section 10.
16. **This project is NOT tied to Python** — the contracts are language-agnostic.
    If the user wants to rewrite a module in TypeScript, Go, or Rust, support that.
