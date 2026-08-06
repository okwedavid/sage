# 🔌 SAGE Plugin Architecture

> **Goal:** grow SAGE into a platform where vertical agents (Finance, Ecommerce,
> Research, Vision, Automation, Developer, Customer Support) ship as **plugins**
> — without modifying the platform core.

**Status:** Core seam implemented (backend v7.1). Reference plugin scaffold:
`backend/src/agents/plugins/agentfinance.ts`.

---

## 1. Why a plugin architecture

SAGE's 5-stage pipeline (Normalize → Classify → Validate → Route → Execute) and
its three built-in workers (General, Web, Vision) cover general-purpose AI
work. Vertical agents add domain expertise: a finance agent knows tickers and
report structures, an ecommerce agent knows product catalogs. We do **not** want
to fork the pipeline per vertical — instead:

- Verticals **declare** which intents they own (task type + domain).
- The router **prefers** the plugin's worker when it claims an intent.
- Everything else (auth, billing, quotas, memory, metrics, admin) stays in the
  platform and applies to plugins automatically.

## 2. Core concepts

### 2.1 The plugin contract (`backend/src/agents/plugin.ts`)

```ts
interface AgentManifest {
  id: string;                 // 'agentfinance' (kebab-case, unique)
  name: string;               // 'AgentFinance'
  version: string;            // '0.1.0' (semver of the plugin)
  description: string;
  icon: string;               // emoji
  color: string;              // brand accent
  status: 'active' | 'beta' | 'planned';
  capabilities: {
    taskTypes: TaskType[];    // which intent task types the plugin claims
    domains?: string[];       // optional domain allow-list ('Finance')
    requires?: string[];      // platform capabilities ('billing')
  };
  provides?: string[];        // agent names surfaced to /api/agents
}

interface AgentPlugin {
  manifest: AgentManifest;
  createWorker?: () => BaseWorker;  // factory, called lazily + cached
}
```

### 2.2 Registration

Plugins self-register on import:

```ts
// backend/src/agents/plugins/agentfinance.ts
registerPlugin(agentFinancePlugin);

// backend/src/agents/index.ts — enable by uncommenting:
// import './plugins/agentfinance';
```

The global store (`listPlugins()`, `getPlugin(id)`) feeds both the registry and
`/api/agents`, so the platform surfaces plugins without knowing about them.

### 2.3 Routing priority

`AgentRegistry.lookup(taskType, outputFormat, domain?)` (extended in v7.1):

1. **Plugin claim** — the first active plugin whose `capabilities` match the
   task type (+ domain, when known) and that provides a worker wins. The worker
   is instantiated once and cached by plugin id.
2. **Built-in routing table** — existing General/Web/Vision mapping.
3. **Fallback** — GeneralWorker.

This means a plugin can (a) take over an existing task type for a domain
(e.g. `ANALYZE` + `Finance` → AgentFinance) and (b) introduce brand-new domains
without touching the platform.

## 3. Building a plugin (recipe)

1. Create `backend/src/agents/plugins/<id>.ts`.
2. Define the manifest with the exact task types/domains the plugin owns.
3. Implement `createWorker(): BaseWorker` — a class with
   `execute(intent): Promise<string>` (same contract as built-in workers).
4. Use the shared prompt builders (`services/prompts.ts`) so safety preambles
   and prompt conventions stay consistent.
5. Register the plugin; add the one-line import to `agents/index.ts`.
6. Add tests: claims matching (`plugin.test.ts` pattern) + worker unit tests.

### Plugin checklist

- [ ] Unique `id`, semver `version`, meaningful `description`
- [ ] `status: 'beta'` until battle-tested
- [ ] `requires` reflects platform needs (e.g. `'billing'` for premium agents)
- [ ] Worker honors `intent.context` (conversation memory) like built-ins
- [ ] No secrets in the plugin — read from `Settings`/env
- [ ] Metrics + audit logs are automatic (platform-side)

## 4. Roadmap of verticals

| Agent | Domain | Status | Notes |
|-------|--------|--------|-------|
| AgentFinance | Finance | 🧭 Scaffolded | See `AGENTFINANCE_SPEC.md` |
| Ecommerce | Commerce | ⬜ | Product research, price analysis |
| Research | General | ✅ Built-in (WebWorker) | Existing worker, could become plugin |
| Vision | Multimodal | ✅ Built-in (VisionWorker) | Image analysis |
| Automation | Workflow | ⬜ | Scheduled/scripted intents |
| Developer | Dev tools | ⬜ | Code generation, review, CI help |
| Customer Support | Support | ⬜ | Ticket triage on org data |

Built-in workers can be migrated to the plugin contract without breaking
existing routes — the registry treats them identically.

## 5. Platform guarantees for plugins

Every plugin inherits, with zero code:

- **Authentication** — JWT + API keys (`jwtOrApiKey`)
- **Quotas & billing** — per-plan daily limits enforced on `/api/chat`
- **Conversation memory** — `intent.context` arrives pre-built by the pipeline
- **Metrics** — runs/errors/latency recorded per worker, shown in Admin
- **Audit logs** — sensitive plugin actions via `recordAudit`
- **Retries & timeouts** — `withRetry` + `GROQ_TIMEOUT_MS`
- **Observability** — structured logging with request IDs

## 6. Guardrails

- Plugins must declare `requires` for premium platform capabilities; the
  platform gates premium agents on subscription tier (e.g. `'billing'`).
- Unrecognized output formats fall back to GeneralWorker (existing behavior).
- A plugin that throws is contained by the pipeline's error handling — it
  degrades to a `System Error` response, never a crash.
