# SAGE v7.0 — Systemic Agentic General Engine

> **AI Cognitive Operating System** — Not a chatbot, not a wrapper.
>
> Think. Understand. Act. Evolve.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 14 Frontend                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Sidebar  │  │  Chat / Dash │  │  Inspector Panel      │ │
│  │ Nav      │  │  Workspace   │  │  (Tools, Stats,       │ │
│  │          │  │  + Composer  │  │   Intent Inspector)   │ │
│  └──────────┘  └──────────────┘  └───────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│               Node.js + Express Backend                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              5-Stage Cognitive Pipeline                  ││
│  │  Normalize → Classify → Validate → Route → Execute     ││
│  └──────────────────────┬──────────────────────────────────┘│
│                         │                                    │
│  ┌──────────┐  ┌────────┴───┐  ┌────────────┐              │
│  │ General  │  │    Web     │  │   Vision   │              │
│  │ Worker   │  │   Worker   │  │   Worker   │              │
│  └──────────┘  └────────────┘  └────────────┘              │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  Supabase (Postgres │
              │  + Auth + Storage)  │
              └─────────────────────┘
```

## 🛠️ Tech Stack

| Layer     | Technology                              |
|-----------|----------------------------------------|
| Frontend  | Next.js 14, React 18, TypeScript       |
| Styling   | Tailwind CSS 3, Framer Motion          |
| State     | Zustand                                |
| Backend   | Node.js, Express 4, TypeScript         |
| AI Engine | Unified provider gateway (OpenAI, Anthropic, Gemini, Groq, OpenRouter, OpenAI-compatible) |
| Database  | Supabase (PostgreSQL + Auth + Realtime) |
| Icons     | Lucide React                           |
| Fonts     | Inter, Space Grotesk, JetBrains Mono   |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Groq API key ([Get one free](https://console.groq.com))
- (Optional) Supabase project ([Create free](https://supabase.com))

### 1. Clone & Install

```bash
cd sage-platform
npm run install:all
```

### 2. Configure Environment

**Backend** (`backend/.env`):
```env
PORT=4000
GROQ_API_KEY=gsk_your_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=change-this-secret
FRONTEND_URL=http://localhost:3000

# Optional tuning (defaults shown)
RATE_LIMIT_MAX=100            # requests per window
RATE_LIMIT_WINDOW_MS=900000   # 15 min
MAX_MESSAGE_LENGTH=50000      # per chat message
MAX_ATTACHMENT_BYTES=8388608  # 8MB per attachment
SAGE_DEFAULT_MODEL=llama-3.3-70b-versatile
SAGE_CREDENTIAL_ENCRYPTION_KEY=  # 32-byte key (base64) for provider API keys; required in production
```

> **Provider credentials**: users' third-party API keys (OpenAI, Anthropic, Gemini,
> Groq, OpenRouter, …) are encrypted at rest with AES-256-GCM. In production you
> **must** set `SAGE_CREDENTIAL_ENCRYPTION_KEY` (a base64-encoded 32-byte key) —
> without it the provider feature refuses to start. See `docs/API.md`.

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Setup Database (Optional)

Run `database/schema.sql` in your Supabase SQL Editor.

### 4. Launch

```bash
# Both frontend + backend
npm run dev

# Or individually
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:3000
```

## 🧪 Testing

The backend ships with a **479-test suite** (49 files) covering the intent
pipeline (including greeting/CHAT classification), the provider system
(credential encryption, adapters, model discovery, isolation), conversation
memory, image analysis, and all routes/middleware/services — plus dedicated
security, concurrency, performance, and regression suites. Coverage thresholds
(≥90% lines/statements/functions, ≥80% branches) are enforced by CI-ready
vitest config.

```bash
cd backend
npm test                 # run all tests
npm run test:coverage    # coverage report + threshold gate
```

See [`backend/TESTING.md`](backend/TESTING.md) and
[`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) for details.

## 📡 API Endpoints

| Method | Endpoint                  | Description                      |
|--------|---------------------------|----------------------------------|
| POST   | `/api/chat`               | Process message through pipeline |
| GET    | `/api/chat/health`        | Engine health check              |
| POST   | `/api/auth/register`      | Create account                   |
| POST   | `/api/auth/login`         | Sign in                          |
| POST   | `/api/auth/demo`          | Instant demo access              |
| GET    | `/api/conversations`      | List user conversations          |
| POST   | `/api/conversations`      | Create conversation              |
| DELETE | `/api/conversations/:id`  | Delete conversation              |
| GET    | `/api/agents`             | List registered agents           |
| GET    | `/api/agents/status`      | Agent & engine status            |
| GET    | `/api/keys`               | List your Sage API keys (masked) |
| POST   | `/api/keys`               | Create a Sage API key (shown once)| 
| POST   | `/api/keys/:id/rotate`    | Rotate a Sage API key            |
| DELETE | `/api/keys/:id`           | Revoke a Sage API key            |
| GET    | `/api/providers/catalog`  | Available providers & models     |
| GET    | `/api/providers`          | List your connected providers    |
| POST   | `/api/providers/connect`  | Connect a provider with your key |
| GET    | `/api/providers/:id/models`| Discover models for a credential |
| GET    | `/api/providers/:id/health`| Provider/credential health check |
| DELETE | `/api/providers/:id`      | Revoke a provider credential     |
| POST   | `/api/conversations/:id/title` | Update a conversation title  |
| GET    | `/api/billing/plans`      | Public plans catalog             |
| GET    | `/api/billing/my-plan`    | Your plan + usage                 |
| POST   | `/api/billing/checkout`   | Checkout hook (payment provider)  |
| GET    | `/api/organizations`      | List your organizations           |
| GET    | `/api/admin/dashboard`    | Admin: platform metrics           |

Full developer documentation — including how to authenticate with a Sage
API key (`Authorization: Bearer sk_sage_...`) — lives in [`docs/API.md`](docs/API.md).

## 🧠 The Pipeline

Every user input goes through 5 stages:

1. **Normalize** — Clean text, remove emojis, collapse whitespace
2. **Classify** — LLM determines task type, domain, priority, confidence
3. **Validate** — Quality gates (confidence threshold, required fields)
4. **Route** — Priority routing: Image → VisionWorker, URL → WebWorker, Default → GeneralWorker
5. **Execute** — Specialized worker generates the response

### Task Types
`BUILD` · `ANALYZE` · `RESEARCH` · `SUMMARIZE` · `PLAN` · `DEBUG` · `EXPLAIN` · `GENERATE` · `TRANSLATE` · `REVIEW`

### Workers
- **GeneralWorker** — Text tasks via llama-3.3-70b-versatile
- **WebWorker** — URL fetching + web content analysis
- **VisionWorker** — Multimodal image analysis
- *(Planned)* **AudioWorker** — Voice transcription + TTS
- *(Planned)* **ImageGenWorker** — AI image generation

## 🎨 Design System

### Colors
- **Background**: `#0a0a0f` (deep dark)
- **Surface**: `#0f0f17` / `#1c1e2e`
- **Gradient**: `#667eea → #764ba2 → #f093fb`
- **Success**: `#3fb950` · **Warning**: `#f0883e` · **Error**: `#f85149` · **Info**: `#58a6ff`

### Typography
- **Display**: Space Grotesk (headings, branding)
- **Body**: Inter (UI text, content)
- **Code**: JetBrains Mono (data, metrics)

### Inspiration
Raycast · Linear · Arc Browser · Vercel Dashboard

## 📁 Project Structure

```
sage-platform/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Server entry
│   │   ├── config/settings.ts    # Configuration
│   │   ├── middleware/auth.ts    # JWT auth
│   │   ├── routes/               # API routes
│   │   │   ├── chat.ts
│   │   │   ├── auth.ts
│   │   │   ├── conversations.ts
│   │   │   └── agents.ts
│   │   ├── core/intent/          # Pipeline stages
│   │   │   ├── normalizer.ts
│   │   │   ├── classifier.ts
│   │   │   ├── conversation-detector.ts
│   │   │   ├── validator.ts
│   │   │   ├── router.ts
│   │   │   ├── pipeline.ts
│   │   │   ├── schemas.ts
│   │   │   └── enums.ts
│   │   ├── providers/            # BYO provider system
│   │   │   ├── credentials.ts    # AES-256-GCM encryption
│   │   │   ├── gateway.ts        # Unified normalization layer
│   │   │   ├── service.ts        # Orchestration (validate/discover/health)
│   │   │   └── adapters/         # OpenAI, Anthropic, Gemini, Groq, OpenRouter…
│   │   ├── agents/               # AI workers
│   │   │   ├── registry.ts
│   │   │   ├── base-worker.ts
│   │   │   ├── general-worker.ts
│   │   │   ├── web-worker.ts
│   │   │   └── vision-worker.ts
│   │   └── services/supabase.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── layout/           # Sidebar, Header, DashboardLayout
│   │   │   ├── pages/            # Dashboard, Chat, Agents, Settings, Landing
│   │   │   ├── chat/             # Composer, ChatMessage, IntentCard, PipelineViz
│   │   │   └── inspector/        # Inspector panel
│   │   ├── stores/appStore.ts    # Zustand global state
│   │   ├── lib/                  # API client, utilities
│   │   └── types/
│   ├── tailwind.config.ts
│   └── package.json
├── database/
│   └── schema.sql                # Supabase migration
├── package.json                  # Root monorepo scripts
└── README.md
```

## 🔒 Rules

- Never put secrets in frontend code
- API keys in `.env` files only (never committed)
- Forward-only pipeline lifecycle (RECEIVED → COMPLETED)
- Each stage independently testable
- New agents added via registry only
- 8GB RAM constraint (Groq LPU handles heavy lifting)

## 🗺️ Roadmap

- ✅ Sprint 6: Core pipeline + 3 workers + Mission Control UI
- ⬜ Sprint 7: Conversation Memory + RAG + Audio
- ⬜ Sprint 8: Reports & Export (PDF/CSV) + Advanced Tools
- ⬜ Sprint 9: Multi-Agent Orchestration
- ⬜ Sprint 10: Platform Connections (GitHub, Slack)
- ⬜ Sprint 11: Image Generation Worker
- ⬜ Sprint 12: User System + Teams + Permissions
- ⬜ Sprint 13: Edge Deployment (Ollama, PWA)

## 📄 License

MIT — Built with purpose by the SAGE team.
