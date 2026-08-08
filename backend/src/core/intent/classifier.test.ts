/**
 * core/intent/classifier.test.ts — Unit tests for LLM-based intent classification
 *
 * The Groq SDK is mocked so classification logic is tested without network calls.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TaskType, Priority, Status } from '../enums';
import { Settings } from '../../config/settings';

// Injectable Groq response state (vi.hoisted survives mock hoisting)
const { mockState } = vi.hoisted(() => ({
  mockState: { chatContent: '{}', shouldThrow: false, createCalls: [] as any[] },
}));

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    chat = {
      completions: {
        create: async (args: any) => {
          mockState.createCalls.push(args);
          if (mockState.shouldThrow) throw new Error('network down');
          return {
            choices: [{ message: { content: mockState.chatContent } }],
          };
        },
      },
    };
  },
}));

import { IntentClassifier } from './classifier';

afterEach(() => {
  mockState.shouldThrow = false;
  mockState.createCalls = [];
});

function jsonResponse(overrides: Record<string, any> = {}) {
  mockState.chatContent = JSON.stringify({
    task_type: 'REVIEW',
    target_domain: 'General',
    confidence_score: 0.9,
    priority: 'NORMAL',
    summary: 'Test goal',
    ...overrides,
  });
}

describe('IntentClassifier', () => {
  it('requires a valid gsk_ API key', () => {
    expect(() => new IntentClassifier('')).toThrow(/gsk_/);
    expect(() => new IntentClassifier('sk-invalid')).toThrow(/gsk_/);
    expect(() => new IntentClassifier('gsk_test_key')).not.toThrow();
  });

  it('parses a valid classification into an intent', async () => {
    jsonResponse({
      task_type: 'DEBUG',
      target_domain: 'Python',
      confidence_score: 0.93,
      priority: 'HIGH',
      summary: 'Fix the bug',
    });
    const classifier = new IntentClassifier('gsk_test_key');

    const intent = await classifier.classify('my code is broken');

    expect(intent.taskType).toBe(TaskType.DEBUG);
    expect(intent.targetDomain).toBe('Python');
    expect(intent.confidenceScore).toBe(0.93);
    expect(intent.priority).toBe(Priority.HIGH);
    expect(intent.goal).toBe('Fix the bug');
    expect(intent.status).toBe(Status.RECEIVED);
    expect(intent.inputText).toBe('my code is broken');
  });

  it('forces RESEARCH + Web domain when the input contains a URL', async () => {
    jsonResponse({ task_type: 'EXPLAIN', target_domain: 'General' });
    const classifier = new IntentClassifier('gsk_test_key');

    const intent = await classifier.classify('check https://example.com/docs');

    expect(intent.taskType).toBe(TaskType.RESEARCH);
    expect(intent.targetDomain).toBe('Web');
  });

  it('coerces unknown task types to REVIEW', async () => {
    jsonResponse({ task_type: 'DANCE' });
    const classifier = new IntentClassifier('gsk_test_key');

    const intent = await classifier.classify('sort my files by date');

    expect(intent.taskType).toBe(TaskType.REVIEW);
  });

  it('coerces invalid priorities to NORMAL', async () => {
    jsonResponse({ priority: 'URGENT' });
    const classifier = new IntentClassifier('gsk_test_key');

    const intent = await classifier.classify('explain rust lifetimes');

    expect(intent.priority).toBe(Priority.NORMAL);
  });

  it('uses the configured model for classification calls', async () => {
    jsonResponse({});
    const classifier = new IntentClassifier('gsk_test_key', 'custom-8b-model');

    await classifier.classify('explain quantum entanglement');

    expect(mockState.createCalls[0].model).toBe('custom-8b-model');
  });

  it('defaults to an empty goal and entities when the response omits them', async () => {
    mockState.chatContent = JSON.stringify({
      task_type: 'REVIEW',
      target_domain: 'General',
      confidence_score: 0.9,
    });
    const classifier = new IntentClassifier('gsk_test_key');

    const intent = await classifier.classify('draft a terms of service');

    expect(intent.goal).toBe('');
    expect(intent.entities).toEqual({});
  });

  describe('greeting / conversational short-circuit', () => {
    it('classifies greetings as CHAT with high confidence WITHOUT calling the LLM', async () => {
      const classifier = new IntentClassifier('gsk_test_key');

      for (const greeting of ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'how are you']) {
        mockState.createCalls = [];
        const intent = await classifier.classify(greeting);

        expect(intent.taskType).toBe(TaskType.CHAT);
        expect(intent.confidenceScore).toBeGreaterThan(Settings.CONFIDENCE_THRESHOLD);
        // Deterministic path: the LLM must never be called for pure greetings.
        expect(mockState.createCalls).toHaveLength(0);
      }
    });

    it('still classifies greeting-prefixed real tasks via the LLM', async () => {
      jsonResponse({ task_type: 'DEBUG', target_domain: 'Python', confidence_score: 0.9 });
      const classifier = new IntentClassifier('gsk_test_key');

      const intent = await classifier.classify('hey, debug this python error');

      expect(intent.taskType).toBe(TaskType.DEBUG);
      expect(mockState.createCalls).toHaveLength(1);
    });
  });

  it('falls back to a safe REVIEW intent when the API call fails', async () => {
    mockState.shouldThrow = true;
    const classifier = new IntentClassifier('gsk_test_key');

    const intent = await classifier.classify('anything');

    expect(intent.taskType).toBe(TaskType.REVIEW);
    expect(intent.targetDomain).toBe('General');
    expect(intent.confidenceScore).toBe(0.5);
    expect(intent.status).toBe(Status.RECEIVED);
    // The fallback must pass the validation gate, not silently fail the pipeline
    expect(intent.confidenceScore).toBeGreaterThan(Settings.CONFIDENCE_THRESHOLD);
  });
});
