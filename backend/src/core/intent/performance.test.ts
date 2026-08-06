/**
 * core/intent/performance.test.ts — Performance & load sanity checks.
 *
 * Budgets are intentionally generous (10-50x expected) so they only fail on
 * pathological regressions (e.g. O(n²) regex blowups), not on slow CI boxes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { IntentNormalizer } from './normalizer';
import { createIntent } from './schemas';
import { TaskType, OutputFormat, Priority } from '../enums';
import { AgentRegistry } from '../../agents/registry';

const { mockState } = vi.hoisted(() => ({
  mockState: { classifyResult: null as any },
}));

vi.mock('./classifier', () => ({
  IntentClassifier: class {
    async classify() {
      return mockState.classifyResult;
    }
  },
}));

import { IntentPipeline } from './pipeline';

afterEach(() => {
  mockState.classifyResult = null;
});

function buildPipeline() {
  const registry = new AgentRegistry();
  const stub = { execute: async () => 'stub response' };
  registry.registerWorker('GeneralWorker', stub);
  registry.registerWorker('WebWorker', stub);
  registry.registerWorker('VisionWorker', stub);
  return new IntentPipeline('gsk_test_key', registry);
}

function validIntent() {
  return createIntent({
    inputText: 'hello',
    taskType: TaskType.REVIEW,
    targetDomain: 'General',
    confidenceScore: 0.95,
    priority: Priority.NORMAL,
    outputFormat: OutputFormat.MARKDOWN,
  });
}

async function elapsed(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

describe('normalizer throughput', () => {
  it('normalizes 1000 mixed inputs well under the budget', async () => {
    const normalizer = new IntentNormalizer();
    const inputs = Array.from({ length: 1000 }, (_, i) =>
      `  Message #${i} 😀 with 🧠 emojis and   spaced words!  `
    );

    const ms = await elapsed(async () => {
      for (const input of inputs) normalizer.normalize(input);
    });

    expect(ms).toBeLessThan(3000);
  });

  it('handles 10k repeated punctuation without pathological slowdown', async () => {
    const normalizer = new IntentNormalizer();
    const hostile = '!' .repeat(10000) + ' urgent';

    const ms = await elapsed(async () => {
      for (let i = 0; i < 20; i++) normalizer.normalize(hostile);
    });

    expect(ms).toBeLessThan(1000);
  });
});

describe('pipeline throughput (orchestration, LLM mocked)', () => {
  it('processes 25 sequential requests well under the budget', async () => {
    mockState.classifyResult = validIntent();
    const pipeline = buildPipeline();

    const ms = await elapsed(async () => {
      for (let i = 0; i < 25; i++) {
        const result = await pipeline.process(`request number ${i}`);
        expect(result.success).toBe(true);
      }
    });

    expect(ms).toBeLessThan(5000);
  });

  it('handles a 50-request concurrent burst', async () => {
    mockState.classifyResult = validIntent();
    const pipeline = buildPipeline();

    const ms = await elapsed(async () => {
      const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) => pipeline.process(`burst request ${i}`))
      );
      expect(results.every((r) => r.success)).toBe(true);
    });

    expect(ms).toBeLessThan(5000);
  });

  it('executes the worker exactly once per accepted request', async () => {
    let executions = 0;
    const registry = new AgentRegistry();
    registry.registerWorker('GeneralWorker', {
      execute: async () => {
        executions++;
        return 'stub response';
      },
    });
    registry.registerWorker('WebWorker', { execute: async () => 'stub' });
    registry.registerWorker('VisionWorker', { execute: async () => 'stub' });
    const pipeline = new IntentPipeline('gsk_test_key', registry);
    mockState.classifyResult = validIntent();

    const ms = await elapsed(async () => {
      for (let i = 0; i < 25; i++) {
        const result = await pipeline.process(`normal request ${i}`);
        expect(result.success).toBe(true);
      }
    });

    expect(executions).toBe(25);
    expect(ms).toBeLessThan(5000);
  });
});

describe('memory sanity', () => {
  it('does not accumulate stage history across many runs', async () => {
    mockState.classifyResult = validIntent();
    const pipeline = buildPipeline();

    const first = await pipeline.process('first');
    const firstStages = first.stages.length;

    for (let i = 0; i < 100; i++) {
      const result = await pipeline.process(`run ${i}`);
      expect(result.stages).toHaveLength(firstStages); // fresh per call
    }
  });
});
