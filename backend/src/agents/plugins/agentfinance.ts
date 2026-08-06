/**
 * agents/plugins/agentfinance.ts — AgentFinance (SAGE platform plugin)
 *
 * AgentFinance is NOT an independent application. It is the first vertical
 * agent built on the SAGE platform via the plugin contract in
 * agents/plugin.ts. Enabling it is a one-line import in agents/index.ts:
 *
 *   import './plugins/agentfinance';
 *
 * Status: 'planned'. Until `createWorker` is implemented, the manifest is
 * surfaced in /api/agents (so investors can see the roadmap) while routing
 * keeps using the built-in workers. See docs/AGENTFINANCE_SPEC.md for the
 * full product spec and docs/PLUGIN_ARCHITECTURE.md for the extension model.
 */
import { registerPlugin, AgentPlugin } from '../plugin';
import { TaskType } from '../../core/enums';

export const agentFinancePlugin: AgentPlugin = {
  manifest: {
    id: 'agentfinance',
    name: 'AgentFinance',
    version: '0.1.0',
    description: 'Finance agent — portfolio analysis, market research, and financial planning running on SAGE.',
    icon: '💹',
    color: '#3fb950',
    status: 'planned',
    capabilities: {
      taskTypes: [TaskType.ANALYZE, TaskType.RESEARCH, TaskType.PLAN, TaskType.SUMMARIZE],
      domains: ['Finance', 'Finance/Portfolio', 'Finance/Markets', 'Finance/Planning'],
      requires: ['billing'], // premium agent → requires a paid plan
    },
    provides: ['agentfinance'],
  },
  // createWorker: () => new FinanceWorker(), // TODO(agentfinance): implement
};

// Self-registration (idempotent).
registerPlugin(agentFinancePlugin);
