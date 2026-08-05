/**
 * agents/general-worker.test.ts — Unit tests for the general text worker
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createIntent } from '../core/intent/schemas';
import { TaskType, Priority, OutputFormat } from '../core/enums';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    content: 'Worker reply text',
    throwError: false,
    calls: [] as any[],
  },
}));

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    chat = {
      completions: {
        create: async (args: any) => {
          mockState.calls.push(args);
          if (mockState.throwError) throw new Error('groq rate limited');
          return { choices: [{ message: { content: mockState.content } }] };
        },
      },
    };
  },
}));

import { GeneralWorker } from './general-worker';

afterEach(() => {
  mockState.throwError = false;
  mockState.calls = [];
});

function intent(overrides: Record<string, any> = {}) {
  return createIntent({
    inputText: 'Explain black holes',
    taskType: TaskType.EXPLAIN,
    targetDomain: 'Physics',
    goal: 'Explain black holes simply',
    priority: Priority.NORMAL,
    outputFormat: OutputFormat.MARKDOWN,
    ...overrides,
  });
}

describe('GeneralWorker', () => {
  it('returns the LLM response for a valid intent', async () => {
    const worker = new GeneralWorker('gsk_test_key');

    const reply = await worker.execute(intent());

    expect(reply).toBe('Worker reply text');
    expect(mockState.calls).toHaveLength(1);
    const call = mockState.calls[0];
    expect(call.messages[0].role).toBe('system');
    expect(call.messages[0].content).toContain('expert teacher');
    expect(call.messages[1].content).toContain('Domain: Physics');
    expect(call.messages[1].content).toContain('Goal: Explain black holes simply');
    expect(call.messages[1].content).toContain('Request: Explain black holes');
  });

  it('appends context when present', async () => {
    const worker = new GeneralWorker('gsk_test_key');

    await worker.execute(intent({ context: 'prior conversation notes' }));

    expect(mockState.calls[0].messages[1].content).toContain('Context: prior conversation notes');
  });

  it('uses the custom model when provided', async () => {
    const worker = new GeneralWorker('gsk_test_key', 'custom-8b');

    await worker.execute(intent());

    expect(mockState.calls[0].model).toBe('custom-8b');
  });

  it('uses a default system prompt for unknown task types', async () => {
    const worker = new GeneralWorker('gsk_test_key');

    await worker.execute(intent({ taskType: 'UNKNOWN' as TaskType }));

    expect(mockState.calls[0].messages[0].content).toContain('helpful cognitive assistant');
  });

  it('returns an error string (not a throw) when Groq fails', async () => {
    mockState.throwError = true;
    const worker = new GeneralWorker('gsk_test_key');

    const reply = await worker.execute(intent());

    expect(reply).toContain('GeneralWorker ERROR');
    expect(reply).toContain('groq rate limited');
  });
});
