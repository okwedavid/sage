/**
 * agents/registry.test.ts — Unit tests for the agent registry
 */
import { describe, it, expect } from 'vitest';
import { AgentRegistry } from './registry';
import { TaskType, OutputFormat } from '../core/enums';

const stubWorker = { execute: async () => 'ok' };

describe('AgentRegistry', () => {
  it('registers and retrieves workers by name', () => {
    const registry = new AgentRegistry();
    registry.registerWorker('GeneralWorker', stubWorker);

    expect(registry.getWorker('GeneralWorker')).toBe(stubWorker);
    expect(registry.getWorker('Missing')).toBeUndefined();
  });

  it('lists registered worker names', () => {
    const registry = new AgentRegistry();
    registry.registerWorker('GeneralWorker', stubWorker);
    registry.registerWorker('WebWorker', stubWorker);

    expect(registry.listWorkers().sort()).toEqual(['GeneralWorker', 'WebWorker']);
  });

  it('routes RESEARCH + MARKDOWN to WebWorker', () => {
    const registry = new AgentRegistry();
    registry.registerWorker('GeneralWorker', stubWorker);
    registry.registerWorker('WebWorker', stubWorker);

    const { worker, name } = registry.lookup(TaskType.RESEARCH, OutputFormat.MARKDOWN);

    expect(name).toBe('WebWorker');
    expect(worker).toBe(stubWorker);
  });

  it('routes ANALYZE + MARKDOWN to WebWorker', () => {
    const registry = new AgentRegistry();
    registry.registerWorker('GeneralWorker', stubWorker);
    registry.registerWorker('WebWorker', stubWorker);

    const { name } = registry.lookup(TaskType.ANALYZE, OutputFormat.MARKDOWN);
    expect(name).toBe('WebWorker');
  });

  it('falls back to GeneralWorker for unmapped combos', () => {
    const registry = new AgentRegistry();
    registry.registerWorker('GeneralWorker', stubWorker);

    const { name } = registry.lookup(TaskType.TRANSLATE, OutputFormat.MARKDOWN);
    expect(name).toBe('GeneralWorker');
  });

  it('falls back to GeneralWorker when the mapped worker is missing', () => {
    const registry = new AgentRegistry();
    registry.registerWorker('GeneralWorker', stubWorker);
    // MARKDOWN/IMAGE default to workers that are NOT registered → falls back
    const { name } = registry.lookup(TaskType.BUILD, OutputFormat.IMAGE);
    expect(name).toBe('GeneralWorker');
  });

  it('throws when no workers are registered at all', () => {
    const registry = new AgentRegistry();
    expect(() => registry.lookup(TaskType.BUILD, OutputFormat.TEXT)).toThrow(
      /No workers available/
    );
  });

  it('falls back to GeneralWorker for unknown output formats', () => {
    const registry = new AgentRegistry();
    registry.registerWorker('GeneralWorker', stubWorker);

    const { name } = registry.lookup(TaskType.BUILD, 'WEIRD' as OutputFormat);

    expect(name).toBe('GeneralWorker');
  });
});
