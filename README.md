# SAGE — Systemic Agentic General Engine v6.0

**AI Cognitive Operating System** — Not a chatbot, not a wrapper.

> Think. Understand. Act. Evolve.

## Architecture

```
User Input → Normalize → Classify → Validate → Route → Execute → Validate → Respond
```

The LLM is a **worker** at the bottom, not the architect at the top.

- **Testable** — Each stage verified independently
- **Scalable** — Plugin architecture, new agents via registry
- **Observable** — Full pipeline trace
- **Language-agnostic** — Contracts reimplementable in any language

## Quick Start (Ubuntu)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set API key
echo "GROQ_API_KEY=gsk_yourkey" > .env

# CLI
python3 run_sage.py

# Web UI (Premium Mission Control)
streamlit run app.py

# Tests
python3 main.py
```

## Project Structure

```
sage/
├── app.py (60 lines orchestration)
├── run_sage.py (CLI)
├── main.py (tests)
├── config/settings.py
├── core/intent/ (normalizer, classifier, validator, router, pipeline, enums, schemas)
├── agents/ (registry, base_worker, general, web, vision)
├── services/audio_service.py
├── ui/
│   ├── styles/ (palette, theme, css)
│   ├── state.py, boot.py
│   ├── components/ (sidebar, chat_panel, intent_card, response_card, inspector, attachment_panel, composer, pipeline_viz)
│   └── layouts/workspace.py
└── SAGE_AGENT_HANDOFF.md (single source of truth)
```

## Target UI

Mission Control Center — deep dark #0a0a0f, purple-blue gradient #667eea→#764ba2→#f093fb, 3-column layout (Nav | Cognitive Workspace | Intelligence Panel), universal composer.

Inspiration: Raycast, Linear, Arc Browser, Vercel Dashboard.

## Workers

- **GeneralWorker** — Text research, explain, debug, build, plan
- **WebWorker** — URL fetch + analysis (requests + BeautifulSoup)
- **VisionWorker** — Image analysis via Groq vision model

Routing Priority:
1. Image attachment → VisionWorker
2. URL detected → WebWorker
3. Default → GeneralWorker

## Roadmap

- Sprint 7: Conversation Memory + RAG
- Sprint 8: Reports & Export (PDF/CSV)
- Sprint 9: Multi-Agent Orchestration
- Sprint 10: Platform Connections (GitHub, Slack)
- Sprint 11: Advanced Vision (image generation)
- Sprint 12: User System
- Sprint 13: Edge Deployment (Ollama, PWA)

## Rules

- Never run files inside core/ directly
- API keys in .env only
- Forward-only lifecycle (RECEIVED → COMPLETED)
- When models decommissioned, update only model string in settings.py
- 8GB RAM constraint

## Author

gamp — Beginner Builder → Systems Architect trajectory
