/**
 * core/enums.test.ts — Unit tests for the status lifecycle
 */
import { describe, it, expect } from 'vitest';
import { TaskType, Priority, Status, OutputFormat, canAdvanceStatus } from './enums';

describe('TaskType', () => {
  it('has all 10 task types', () => {
    expect(Object.values(TaskType)).toHaveLength(10);
    expect(TaskType.BUILD).toBe('BUILD');
    expect(TaskType.REVIEW).toBe('REVIEW');
  });
});

describe('Status lifecycle (forward-only)', () => {
  it('allows forward transitions', () => {
    expect(canAdvanceStatus(Status.RECEIVED, Status.VALIDATED)).toBe(true);
    expect(canAdvanceStatus(Status.VALIDATED, Status.ROUTED)).toBe(true);
    expect(canAdvanceStatus(Status.ROUTED, Status.EXECUTING)).toBe(true);
    expect(canAdvanceStatus(Status.EXECUTING, Status.COMPLETED)).toBe(true);
  });

  it('rejects backward transitions', () => {
    expect(canAdvanceStatus(Status.COMPLETED, Status.EXECUTING)).toBe(false);
    expect(canAdvanceStatus(Status.ROUTED, Status.VALIDATED)).toBe(false);
    expect(canAdvanceStatus(Status.VALIDATED, Status.RECEIVED)).toBe(false);
  });

  it('rejects same-status transitions', () => {
    expect(canAdvanceStatus(Status.RECEIVED, Status.RECEIVED)).toBe(false);
  });

  it('rejects transitions from FAILED', () => {
    expect(canAdvanceStatus(Status.FAILED, Status.COMPLETED)).toBe(false);
    expect(canAdvanceStatus(Status.FAILED, Status.VALIDATED)).toBe(false);
  });
});

describe('Enum completeness', () => {
  it('has all priorities', () => {
    expect(Object.values(Priority)).toEqual(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);
  });

  it('has all output formats', () => {
    expect(Object.values(OutputFormat)).toContain('MARKDOWN');
    expect(Object.values(OutputFormat)).toContain('JSON');
    expect(Object.values(OutputFormat)).toContain('PDF');
  });
});
