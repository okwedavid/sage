/**
 * core/intent/schemas.test.ts — Unit tests for intent schema factory & helpers
 */
import { describe, it, expect } from 'vitest';
import { createIntent, advanceStatus, intentToDict } from './schemas';
import { TaskType, Priority, Status, OutputFormat } from '../enums';

describe('createIntent', () => {
  it('creates a fully-populated intent with defaults', () => {
    const intent = createIntent({ inputText: 'Build a REST API' });

    expect(intent.inputText).toBe('Build a REST API');
    expect(intent.intentId).toBeTruthy();
    expect(intent.taskType).toBe(TaskType.REVIEW);
    expect(intent.targetDomain).toBe('General');
    expect(intent.confidenceScore).toBe(0);
    expect(intent.priority).toBe(Priority.NORMAL);
    expect(intent.outputFormat).toBe(OutputFormat.MARKDOWN);
    expect(intent.status).toBe(Status.RECEIVED);
    expect(intent.createdAt).toBeTruthy();
  });

  it('throws on empty inputText', () => {
    expect(() => createIntent({ inputText: '' })).toThrow();
    expect(() => createIntent({ inputText: '   ' })).toThrow();
  });

  it('throws on out-of-range confidence', () => {
    expect(() => createIntent({ inputText: 'x', confidenceScore: 1.5 })).toThrow();
    expect(() => createIntent({ inputText: 'x', confidenceScore: -0.1 })).toThrow();
  });

  it('preserves provided values', () => {
    const intent = createIntent({
      inputText: 'Debug this',
      taskType: TaskType.DEBUG,
      targetDomain: 'Python',
      confidenceScore: 0.9,
      priority: Priority.HIGH,
      outputFormat: OutputFormat.PYTHON,
    });
    expect(intent.taskType).toBe(TaskType.DEBUG);
    expect(intent.targetDomain).toBe('Python');
    expect(intent.confidenceScore).toBe(0.9);
    expect(intent.priority).toBe(Priority.HIGH);
    expect(intent.outputFormat).toBe(OutputFormat.PYTHON);
  });
});

describe('advanceStatus', () => {
  it('advances a valid transition', () => {
    const intent = createIntent({ inputText: 'x' });
    const advanced = advanceStatus(intent, Status.VALIDATED);
    expect(advanced.status).toBe(Status.VALIDATED);
    expect(advanced).not.toBe(intent); // immutable
  });

  it('throws on backward transition', () => {
    const intent = createIntent({ inputText: 'x', status: Status.EXECUTING });
    expect(() => advanceStatus(intent, Status.RECEIVED)).toThrow();
  });

  it('throws when advancing to the terminal FAILED status', () => {
    const intent = createIntent({ inputText: 'x' });
    expect(() => advanceStatus(intent, Status.FAILED)).toThrow();
  });
});

describe('intentToDict', () => {
  it('maps to snake_case API shape', () => {
    const intent = createIntent({
      inputText: 'x',
      taskType: TaskType.BUILD,
      targetDomain: 'TypeScript',
      confidenceScore: 0.8,
    });
    const dict = intentToDict(intent);

    expect(dict.task_type).toBe('BUILD');
    expect(dict.target_domain).toBe('TypeScript');
    expect(dict.confidence_score).toBe(0.8);
    expect(dict.intent_id).toBe(intent.intentId);
    expect(dict.status).toBe(Status.RECEIVED);
    expect(dict.has_attachments).toBe(false);
    expect(dict.input_text).toBe('x');
  });
});
