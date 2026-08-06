/**
 * agents/plugin.ts
 * OWNS: The plugin contract — the seam where new agents plug into SAGE
 * without modifying the platform core.
 *
 * A "plugin" is a self-describing module with an AgentManifest and (optionally)
 * a worker factory. Plugins declare which intents they claim via
 * `capabilities.taskTypes` (+ optional `domains`). The AgentRegistry consults
 * registered plugins BEFORE its built-in routing table, so a plugin can take
 * over a task type or introduce a brand-new one — no platform changes needed.
 *
 * Example: AgentFinance registers `capabilities: { taskTypes: [ANALYZE],
 * domains: ['Finance'] }` and the router sends `ANALYZE` intents whose domain
 * is Finance to its worker, while other ANALYZE intents keep flowing to the
 * built-in WebWorker.
 *
 * See docs/PLUGIN_ARCHITECTURE.md for the full design.
 */
import { BaseWorker } from './base-worker';
import { TaskType } from '../core/enums';

export interface PluginCapabilities {
  /** Task types this plugin claims (at least one required). */
  taskTypes: TaskType[];
  /** Optional domain allow-list. Empty/undefined = claims all domains. */
  domains?: string[];
  /** Platform capabilities the plugin needs (e.g. 'billing', 'storage'). */
  requires?: string[];
}

export interface AgentManifest {
  /** Unique stable id (kebab-case), e.g. 'agentfinance'. */
  id: string;
  /** Display name, e.g. 'AgentFinance'. */
  name: string;
  /** Semver of the plugin itself. */
  version: string;
  description: string;
  icon: string;
  color: string;
  status: 'active' | 'beta' | 'planned';
  capabilities: PluginCapabilities;
  /** Agent names this plugin provides (defaults to [id]). */
  provides?: string[];
}

export interface AgentPlugin {
  manifest: AgentManifest;
  /**
   * Factory invoked (and cached) when the plugin claims an intent. May return
   * null if the plugin is not ready to serve that intent yet.
   */
  createWorker?: () => BaseWorker;
}

// ── Global plugin store ──────────────────────────────────────────────────────
// Plugins self-register on import (e.g. `import './plugins/agentfinance'` in
// the agents index). The registry + agents route read from here.

const store = new Map<string, AgentPlugin>();

export function registerPlugin(plugin: AgentPlugin): void {
  store.set(plugin.manifest.id, plugin);
  console.log(`   🔌 Registered plugin: ${plugin.manifest.name} v${plugin.manifest.version}`);
}

export function getPlugin(id: string): AgentPlugin | undefined {
  return store.get(id);
}

export function listPlugins(): AgentPlugin[] {
  return Array.from(store.values());
}

export function listPluginManifests(): AgentManifest[] {
  return listPlugins().map((p) => p.manifest);
}

/** Does this plugin claim the given intent (task type + optional domain)? */
export function pluginClaims(plugin: AgentPlugin, taskType: TaskType, domain?: string): boolean {
  const caps = plugin.manifest.capabilities;
  if (!caps.taskTypes.includes(taskType)) return false;
  if (caps.domains && caps.domains.length > 0 && domain && !caps.domains.includes(domain)) return false;
  return true;
}

/** First plugin (in registration order) that claims the intent and can serve it. */
export function findClaimingPlugin(taskType: TaskType, domain?: string): AgentPlugin | undefined {
  return listPlugins().find(
    (p) => p.manifest.status !== 'planned' && pluginClaims(p, taskType, domain) && typeof p.createWorker === 'function'
  );
}
