/**
 * core/intent/validator.test.ts — Unit tests for the quality gate
 */
import { describe, it, expect } from 'vitest';
import { IntentValidator } from './validator';
import { createIntent } from './schemas';
import { TaskType, Status } from '../enums';

const validator = new IntentValidator();

function validIntent() {
  return createIntent({
    inputText: 'Research web frameworks',
    taskType: TaskType.RESEARCH,
    targetDomain: 'Web',
    confidenceScore: 0.9,
  });
}

describe('IntentValidator', () => {
  it('approves a high-confidence intent with all fields', () => {
    const result = validator.validate(validIntent());
    expect(result.status).toBe(Status.VALIDATED);
    expect(result.context).toBe('');
  });

  it('rejects intents below confidence threshold', () => {
    const lowConfidence = createIntent({
      inputText: 'x',
      taskType: TaskType.REVIEW,
      targetDomain: 'General',
      confidenceScore: 0.1,
    });
    const result = validator.validate(lowConfidence);
    expect(result.status).toBe(Status.FAILED);
    expect(result.context).toContain('Confidence too low');
  });

  it('rejects intents with missing target domain', () => {
    const noDomain = createIntent({
      inputText: 'x',
      taskType: TaskType.REVIEW,
      targetDomain: '   ',
      confidenceScore: 0.9,
    });
    const result = validator.validate(noDomain);
    expect(result.status).toBe(Status.FAILED);
    expect(result.context).toContain('No target_domain');
  });

  it('rejects intents with missing task type', () => {
    const noTask = {
      ...validIntent(),
      taskType: '' as any,
    };
    const result = validator.validate(noTask);
    expect(result.status).toBe(Status.FAILED);
    expect(result.context).toContain('No task_type');
  });
});
