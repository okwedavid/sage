/**
 * core/intent/regression.test.ts — Pins every previously fixed bug.
 *
 * These tests guard against regressions of bugs that were found and fixed in
 * earlier sessions. If any of these fail, a fix has been reverted.
 */
import { describe, it, expect } from 'vitest';
import { IntentNormalizer } from './normalizer';
import { IntentValidator } from './validator';
import { createIntent, advanceStatus } from './schemas';
import { Status, TaskType, Priority, OutputFormat } from '../enums';

describe('Regression: emoji removal leaves double spaces', () => {
  it('collapses whitespace left behind by removed emojis', () => {
    const normalizer = new IntentNormalizer();
    expect(normalizer.normalize('hello 😀 world')).toBe('hello world');
    expect(normalizer.normalize('foo  😀  bar')).toBe('foo bar');
  });
});

describe('Regression: whitespace-only input slipped past the guard', () => {
  it('throws for whitespace-only input', () => {
    const normalizer = new IntentNormalizer();
    expect(() => normalizer.normalize('   ')).toThrow(/empty input/);
    expect(() => normalizer.normalize('\t\n  ')).toThrow(/empty input/);
  });

  it('createIntent still rejects empty input', () => {
    expect(() => createIntent({ inputText: '   ' })).toThrow(/cannot be empty/);
  });
});

describe('Regression: newer emoji (U+1F900+) were not stripped', () => {
  it('removes the brain emoji and supplemental pictographs', () => {
    const normalizer = new IntentNormalizer();
    expect(normalizer.normalize('🧠')).toBe('');
    expect(normalizer.normalize('think 🧠 hard')).toBe('think hard');
    expect(normalizer.normalize('🧠🤖')).toBe('');
  });

  it('removes FE0F variation selectors', () => {
    const normalizer = new IntentNormalizer();
    // ✅︎ with variation selector
    expect(normalizer.normalize('✅\uFE0F done')).toBe('done');
  });
});

describe('Regression: forward skip-transitions are valid', () => {
  it('allows RECEIVED → EXECUTING (skip)', () => {
    const intent = createIntent({ inputText: 'x' });
    expect(() => advanceStatus(intent, Status.EXECUTING)).not.toThrow();
  });

  it('allows RECEIVED → COMPLETED via skip', () => {
    const intent = createIntent({ inputText: 'x' });
    expect(() => advanceStatus(intent, Status.COMPLETED)).not.toThrow();
  });
});

describe('Regression: backward transitions are rejected', () => {
  it('rejects EXECUTING → RECEIVED', () => {
    const intent = createIntent({ inputText: 'x', status: Status.EXECUTING });
    expect(() => advanceStatus(intent, Status.RECEIVED)).toThrow(/Cannot advance/);
  });

  it('rejects VALIDATED → RECEIVED', () => {
    const intent = createIntent({ inputText: 'x', status: Status.VALIDATED });
    expect(() => advanceStatus(intent, Status.RECEIVED)).toThrow(/Cannot advance/);
  });
});

describe('Regression: FAILED is terminal', () => {
  it('rejects advancing from FAILED', () => {
    const intent = createIntent({ inputText: 'x', status: Status.FAILED });
    expect(() => advanceStatus(intent, Status.COMPLETED)).toThrow(/Cannot advance/);
  });

  it('never transitions a FAILED intent through validation', () => {
    const validator = new IntentValidator();
    const failed = validator.validate(
      createIntent({
        inputText: 'x',
        taskType: TaskType.REVIEW,
        targetDomain: 'General',
        confidenceScore: 0.1,
        priority: Priority.NORMAL,
        outputFormat: OutputFormat.MARKDOWN,
      })
    );
    expect(failed.status).toBe(Status.FAILED);
  });
});
