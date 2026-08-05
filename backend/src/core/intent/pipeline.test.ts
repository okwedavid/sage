/**
 * core/intent/pipeline.test.ts — Integration tests for the 5-stage orchestrator
 *
 * The Groq-backed classifier is mocked so tests are fast and deterministic.
 * The real normalizer, validator, router, and AgentRegistry are exercised.
 */
import { describe, it, expect, vi } from 'vitest';
import { createIntent } from './schemas';
import { TaskType, Status, OutputFormat, Priority } from '../enums';
import { AgentRegistry } from '../../agents/registry';

// Injectable classifier state (vi.hoisted survives mock hoisting)
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

const stubWorker = { execute: async () => 'stub response' };

function buildPipeline(workers: Record<string, any> = {}): IntentPipeline {
  const registry = new AgentRegistry();
  registry.registerWorker('GeneralWorker', workers.general ?? stubWorker);
  registry.registerWorker('WebWorker', workers.web ?? stubWorker);
  registry.registerWorker('VisionWorker', workers.vision ?? stubWorker);
  return new IntentPipeline('gsk_test_key', registry);
}

function validClassifyResult(overrides: Record<string, any> = {}) {
  return createIntent({
    inputText: 'research quantum computing',
    taskType: TaskType.RESEARCH,
    targetDomain: 'Physics',
    confidenceScore: 0.95,
    priority: Priority.NORMAL,
    outputFormat: OutputFormat.MARKDOWN,
    ...overrides,
  });
}

describe('IntentPipeline', () => {
  it('runs all 5 stages successfully end-to-end', async () => {
    mockState.classifyResult = validClassifyResult();
    const pipeline = buildPipeline();

    const result = await pipeline.process('  Research  Quantum 🧠 Computing  ');

    expect(result.success).toBe(true);
    expect(result.agent).toBe('WebWorker');
    expect(result.response).toBe('stub response');
    expect(result.intent?.status).toBe(Status.COMPLETED);
    expect(result.stages.map((s) => s.name)).toEqual([
      'normalize',
      'classify',
      'validate',
      'route',
      'execute',
    ]);
    expect(result.stages.every((s) => s.success)).toBe(true);
    // Stage 1 detail is the normalized input
    expect(result.stages[0].detail).toContain('research quantum computing');
    // Stage 2 detail reports task type + confidence
    expect(result.stages[1].detail).toContain('RESEARCH (95%)');
  });

  it('merges attachments and routes to VisionWorker', async () => {
    mockState.classifyResult = validClassifyResult({
      taskType: TaskType.ANALYZE,
      targetDomain: 'Computer Vision',
      inputText: 'analyze this image',
    });
    const pipeline = buildPipeline();

    const result = await pipeline.process('analyze this image', {
      image_base64: 'aGVsbG8=',
      image_type: 'png',
    });

    expect(result.success).toBe(true);
    expect(result.agent).toBe('VisionWorker');
    expect(result.intent?.attachments.image_base64).toBe('aGVsbG8=');
    expect(result.stages[3].detail).toBe('VisionWorker');
  });

  it('rejects low-confidence intents at the validation gate', async () => {
    mockState.classifyResult = validClassifyResult({ confidenceScore: 0.1 });
    const pipeline = buildPipeline();

    const result = await pipeline.process('vague request');

    expect(result.success).toBe(false);
    expect(result.response).toContain('Rejected');
    expect(result.intent?.status).toBe(Status.FAILED);
    expect(result.stages.map((s) => s.name)).toEqual([
      'normalize',
      'classify',
      'validate',
    ]);
    expect(result.stages[2].success).toBe(false);
  });

  it('surfaces worker failures as a System Error', async () => {
    mockState.classifyResult = validClassifyResult({
      taskType: TaskType.EXPLAIN,
      targetDomain: 'Physics',
    });
    const pipeline = buildPipeline({
      general: {
        execute: async () => {
          throw new Error('groq timeout');
        },
      },
    });

    const result = await pipeline.process('explain relativity');

    expect(result.success).toBe(false);
    expect(result.response).toBe('System Error: groq timeout');
    // normalize, classify, validate, route completed; execute never recorded
    expect(result.stages.map((s) => s.name)).toEqual([
      'normalize',
      'classify',
      'validate',
      'route',
    ]);
  });

  it('fails fast with no stages when normalization throws', async () => {
    const pipeline = buildPipeline();

    const result = await pipeline.process('   ');

    expect(result.success).toBe(false);
    expect(result.response).toContain('System Error');
    expect(result.stages).toHaveLength(0);
  });

  it('surfaces a rogue pre-advanced intent as a controlled System Error', async () => {
    // A hostile classifier result claiming to already be EXECUTING must not
    // crash the process — the validator rejects the backwards/same-state
    // transition and the pipeline converts it into a System Error.
    mockState.classifyResult = validClassifyResult({ status: Status.EXECUTING });
    const pipeline = buildPipeline();

    const result = await pipeline.process('hello');

    expect(result.success).toBe(false);
    expect(result.response).toContain('System Error');
    expect(result.stages.map((s) => s.name)).toEqual(['normalize', 'classify']);
  });
});
