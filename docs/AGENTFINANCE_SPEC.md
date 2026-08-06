# 💹 AgentFinance — Product Specification (SAGE platform plugin)

> **Positioning:** AgentFinance is a **premium vertical agent that runs on the
> SAGE platform** — not an independent application. It reuses SAGE's pipeline,
> auth, billing, memory, metrics, and admin tooling, and adds domain expertise
> for finance.

**Status:** Scaffolded (`backend/src/agents/plugins/agentfinance.ts`,
`status: 'planned'`). Enabling = one import in `agents/index.ts` once the
worker is implemented.

---

## 1. Product summary

AgentFinance answers finance questions with structured, sourced output:

- **Portfolio analysis** — holdings, allocation, risk exposure
- **Market research** — sector/company briefs, macro context
- **Financial planning** — budgeting, goals, scenario planning
- **Report summarization** — earnings, filings, newsletters

It is **not** a brokerage or trading executor. It provides analysis and
explanation; any actionable step is explicitly flagged as needing human
verification.

## 2. Intent claims (the plugin contract)

```ts
capabilities: {
  taskTypes: [TaskType.ANALYZE, TaskType.RESEARCH, TaskType.PLAN, TaskType.SUMMARIZE],
  domains: ['Finance', 'Finance/Portfolio', 'Finance/Markets', 'Finance/Planning'],
  requires: ['billing'],          // premium agent → paid plan gate
}
```

Effect: an `ANALYZE` intent about **Finance** routes to AgentFinance; the same
intent about Healthcare keeps flowing to the built-in WebWorker.

## 3. Worker behavior

`FinanceWorker implements BaseWorker` (planned):

1. Parse the intent + `intent.context` (conversation memory) for entities:
   tickers, asset classes, timeframes, portfolio context.
2. Pull market data via a data provider (e.g. Alpha Vantage / Finnhub /
   provider-of-choice) with caching + graceful degradation when unavailable.
3. Compose a structured markdown report via `buildSystemPrompt` + `buildUserPrompt`
   (shared prompt orchestration), sections: Summary · Key Metrics · Analysis ·
   Risks · Sources.
4. Return markdown; pipeline handles metrics, audit, retries automatically.

### Data sources (decision point — needs human choice at build time)
| Source | Cost | Coverage | Notes |
|--------|------|----------|-------|
| Alpha Vantage | Free key / paid | Equities, FX, crypto | Rate-limited free tier |
| Finnhub | Free key / paid | Equities, fundamentals | Good free tier |
| Yahoo Finance (unofficial) | Free | Broad | Unstable API, not for prod |

**Recommendation:** start with a paid key with a free tier; cache aggressively.

## 4. Monetization

AgentFinance is a **premium agent**: `requires: ['billing']` and the platform
gates premium-capability plugins behind paid plans. Concretely:

- Free plan: sees AgentFinance in `/api/agents` (roadmap), cannot invoke it.
- Pro/Team: can invoke; usage metered against the plan's daily quota.

This is enforced by the billing layer the platform already ships (see
`COMMERCIAL_READINESS.md`), so no per-plugin billing code is needed.

## 5. UX surface

- **Agents page**: AgentFinance card (from `/api/agents` → `plugins` array).
- **Chat**: Finance-domain intents route automatically; the `IntentCard` shows
  the claimed agent (`agentfinance`).
- **Billing page**: plan comparison already lists the feature ("Full API access").
  Add an AgentFinance line to Pro/Team feature lists when it ships.

## 6. Release phases

| Phase | Scope | Gate |
|-------|-------|------|
| 1 — Foundation | Manifest + routing claim + unit tests (done in scaffold) | None |
| 2 — Market briefs | RESEARCH/ANALYZE on public data (one provider) | Data provider key |
| 3 — Portfolio | User-supplied holdings context via conversation memory | None |
| 4 — Premium gate | Require Pro/Team to invoke | Billing wired (already) |
| 5 — Planning | Scenario planning with clear disclaimers | Review |

## 7. Compliance guardrails

- Always include "not financial advice" framing in system prompts.
- Clearly separate factual data (sourced) from analysis (opinion).
- Never claim executed trades or holdings the user did not provide.
- Log every FinanceWorker invocation via existing metrics/audit paths.
