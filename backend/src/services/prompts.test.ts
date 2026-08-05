/**
 * services/prompts.test.ts — Prompt orchestration
 */
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, SAFETY_PREAMBLE } from './prompts';
import { TaskType } from '../core/enums';

const baseIntent = {
  targetDomain: 'Physics',
  goal: 'Explain gravity',
  inputText: 'What is gravity?',
  context: undefined as string | undefined,
};

describe('buildSystemPrompt', () => {
  it('always includes the safety preamble', () => {
    const p = buildSystemPrompt(TaskType.EXPLAIN);
    expect(p).toContain(SAFETY_PREAMBLE);
  });

  it('selects the task role for known task types', () => {
    expect(buildSystemPrompt(TaskType.EXPLAIN)).toContain('expert teacher');
    expect(buildSystemPrompt(TaskType.RESEARCH)).toContain('deep researcher');
    expect(buildSystemPrompt(TaskType.BUILD)).toContain('software engineer');
  });

  it('falls back to a generic role for unknown types', () => {
    expect(buildSystemPrompt('UNKNOWN')).toContain('helpful cognitive assistant');
  });

  it('prefers an explicit custom role', () => {
    const p = buildSystemPrompt(TaskType.EXPLAIN, 'You are a pirate.');
    expect(p).toContain('pirate');
    expect(p).not.toContain('expert teacher');
  });
});

describe('buildUserPrompt', () => {
  it('builds domain, goal, and request sections', () => {
    const p = buildUserPrompt({ intent: baseIntent });
    expect(p).toContain('Domain: Physics');
    expect(p).toContain('Goal: Explain gravity');
    expect(p).toContain('Request: What is gravity?');
  });

  it('omits goal when absent', () => {
    const p = buildUserPrompt({ intent: { ...baseIntent, goal: '' } });
    expect(p).not.toContain('Goal:');
  });

  it('includes additional context when present', () => {
    const p = buildUserPrompt({ intent: { ...baseIntent, context: 'prior notes' } });
    expect(p).toContain('Additional context: prior notes');
  });

  it('appends extra instructions when provided', () => {
    const p = buildUserPrompt({ intent: baseIntent, extra: 'Answer in 3 bullet points.' });
    expect(p).toContain('Instructions: Answer in 3 bullet points.');
  });
});
