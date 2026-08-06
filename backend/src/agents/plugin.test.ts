/**
 * agents/plugin.test.ts — Unit tests for the plugin contract + registry routing.
 * Registers throwaway plugins with unique ids; the store is per-test-file.
 */
import { describe, it, expect } from 'vitest';
import { registerPlugin, getPlugin, listPluginManifests, pluginClaims, findClaimingPlugin, AgentPlugin } from './plugin';
import { AgentRegistry } from './registry';
import { TaskType, OutputFormat } from '../core/enums';

const stubWorker = { execute: async () => 'ok' };

const financePlugin: AgentPlugin = {
  manifest: {
    id: 'test-finance',
    name: 'TestFinance',
    version: '0.1.0',
    description: 'Test plugin',
    icon: '💹',
    color: '#3fb950',
    status: 'active',
    capabilities: { taskTypes: [TaskType.ANALYZE, TaskType.RESEARCH], domains: ['Finance'] },
  },
  createWorker: () => stubWorker,
};

const plannedPlugin: AgentPlugin = {
  manifest: {
    id: 'test-planned',
    name: 'TestPlanned',
    version: '0.1.0',
    description: 'Planned plugin',
    icon: '🕓',
    color: '#888',
    status: 'planned',
    capabilities: { taskTypes: [TaskType.PLAN] },
  },
};

describe('plugin store', () => {
  it('registers, retrieves, and lists plugins', () => {
    registerPlugin(financePlugin);
    registerPlugin(plannedPlugin);

    expect(getPlugin('test-finance')?.manifest.name).toBe('TestFinance');
    const manifests = listPluginManifests();
    expect(manifests.map((m) => m.id)).toContain('test-finance');
  });

  it('matches claims by task type and optional domain', () => {
    expect(pluginClaims(financePlugin, TaskType.ANALYZE, 'Finance')).toBe(true);
    expect(pluginClaims(financePlugin, TaskType.ANALYZE, 'Healthcare')).toBe(false); // domain mismatch
    expect(pluginClaims(financePlugin, TaskType.BUILD, 'Finance')).toBe(false); // task mismatch
    // No domain provided → plugin claims the task (domains only narrow when known).
    expect(pluginClaims(financePlugin, TaskType.ANALYZE, undefined)).toBe(true);
  });

  it('only finds active plugins with a worker factory', () => {
    // The planned plugin has no worker factory → never claimable.
    expect(findClaimingPlugin(TaskType.PLAN, 'Finance')).toBeUndefined();
    // Active plugin with a worker factory claims matching intents.
    const claimable = findClaimingPlugin(TaskType.ANALYZE, 'Finance');
    expect(claimable?.manifest.id).toBe('test-finance');
    // Domain mismatch → no claim.
    expect(findClaimingPlugin(TaskType.ANALYZE, 'Healthcare')).toBeUndefined();
  });
});

describe('registry plugin routing', () => {
  it('routes a claimed intent to the plugin worker ahead of built-ins', () => {
    const registry = new AgentRegistry();
    registry.registerWorker('GeneralWorker', stubWorker);
    registry.registerWorker('WebWorker', stubWorker);

    // Domain matches the plugin → plugin wins over WebWorker.
    const { name } = registry.lookup(TaskType.ANALYZE, OutputFormat.MARKDOWN, 'Finance');
    expect(name).toBe('test-finance');

    // Different domain → built-in routing (WebWorker for ANALYZE/MARKDOWN).
    const builtIn = registry.lookup(TaskType.ANALYZE, OutputFormat.MARKDOWN, 'Healthcare');
    expect(builtIn.name).toBe('WebWorker');
  });

  it('caches the plugin worker after first instantiation', () => {
    const registry = new AgentRegistry();
    let instantiations = 0;
    registerPlugin({
      manifest: {
        id: 'test-cache',
        name: 'TestCache',
        version: '0.1.0',
        description: 'Cache test',
        icon: '🧊',
        color: '#58a6ff',
        status: 'active',
        capabilities: { taskTypes: [TaskType.SUMMARIZE] },
      },
      createWorker: () => {
        instantiations += 1;
        return stubWorker;
      },
    });

    registry.lookup(TaskType.SUMMARIZE, OutputFormat.MARKDOWN, 'General');
    registry.lookup(TaskType.SUMMARIZE, OutputFormat.MARKDOWN, 'General');
    expect(instantiations).toBe(1);
  });
});
