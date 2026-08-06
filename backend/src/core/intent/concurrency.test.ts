/**
 * core/intent/concurrency.test.ts — Proves the pipeline is safe under load.
 *
 * A single pipeline instance is shared across many concurrent `process()`
 * calls with per-input classifier results. Verifies there is no
 * cross-contamination between requests and that a failure in one request
 * cannot poison its neighbors.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createIntent } from './schemas';
import { TaskType, Status, OutputFormat, Priority } from '../enums';
import { AgentRegistry } from '../../agents/registry';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    // Either a fixed intent or a function (input) => IntentSchema
    classifyResult: null as any,
  },
}));

vi.mock('./classifier', () => ({
  IntentClassifier: class {
    async classify(text: string) {
      // Small random delay forces concurrent calls to interleave
      await new Promise((r) => setTimeout(r, Math.random() * 5));
      if (typeof mockState.classifyResult === 'function') {
        return mockState.classifyResult(text);
      }
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

function makeIntent(text: string, taskType: TaskType) {
  return createIntent({
    inputText: text,
    taskType,
    targetDomain: taskType === TaskType.BUILD ? 'Code' : 'General',
    confidenceScore: 0.95,
    priority: Priority.NORMAL,
    outputFormat: OutputFormat.MARKDOWN,
  });
}

describe('IntentPipeline concurrency', () => {
  it('keeps 20 parallel requests isolated — no cross-contamination', async () => {
    // Derive each result from the request text so mixing would be detected
    mockState.classifyResult = (text: string) =>
      makeIntent(text, text.includes('build') ? TaskType.BUILD : TaskType.REVIEW);

    const pipeline = buildPipeline();
    const inputs = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? `build feature number ${i}` : `review document number ${i}`
    );

    const results = await Promise.all(inputs.map((input) => pipeline.process(input)));

    results.forEach((result, i) => {
      const input = inputs[i];
      expect(result.success).toBe(true);
      expect(result.intent?.inputText).toBe(input); // normalized == original here
      expect(result.intent?.taskType).toBe(
        input.includes('build') ? TaskType.BUILD : TaskType.REVIEW
      );
      expect(result.stages.map((s) => s.name)).toEqual([
        'normalize',
        'classify',
        'validate',
        'route',
        'execute',
      ]);
    });
  });

  it('isolates failures — one rejected request does not affect others', async () => {
    mockState.classifyResult = (text: string) => {
      const base = makeIntent(text, TaskType.REVIEW);
      return text.includes('vague') ? { ...base, confidenceScore: 0.1 } : base;
    };

    const pipeline = buildPipeline();
    const inputs = ['vague request here', 'clear request one', 'clear request two'];

    const results = await Promise.all(inputs.map((input) => pipeline.process(input)));

    expect(results[0].success).toBe(false);
    expect(results[0].intent?.status).toBe(Status.FAILED);
    expect(results[1].success).toBe(true);
    expect(results[2].success).toBe(true);
    expect(results[1].intent?.taskType).toBe(TaskType.REVIEW);
  });

  it('is stateless across sequential reuse', async () => {
    mockState.classifyResult = (text: string) => makeIntent(text, TaskType.REVIEW);
    const pipeline = buildPipeline();

    await pipeline.process('first message');
    const second = await pipeline.process('second message');

    expect(second.intent?.inputText).toBe('second message');
    expect(second.stages).toHaveLength(5); // fresh stage list, not appended
  });

  it('shares a single pipeline instance without leaking intents', async () => {
    mockState.classifyResult = (text: string) => makeIntent(text, TaskType.REVIEW);
    const pipeline = buildPipeline();

    const [a, b, c] = await Promise.all([
      pipeline.process('alpha'),
      pipeline.process('beta'),
      pipeline.process('gamma'),
    ]);

    expect([a.intent?.inputText, b.intent?.inputText, c.intent?.inputText].sort()).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
  });
});
