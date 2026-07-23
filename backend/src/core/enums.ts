/**
 * core/enums.ts
 * OWNS: All domain enums — the type system backbone
 */

export enum TaskType {
  BUILD = 'BUILD',
  ANALYZE = 'ANALYZE',
  RESEARCH = 'RESEARCH',
  SUMMARIZE = 'SUMMARIZE',
  PLAN = 'PLAN',
  DEBUG = 'DEBUG',
  EXPLAIN = 'EXPLAIN',
  GENERATE = 'GENERATE',
  TRANSLATE = 'TRANSLATE',
  REVIEW = 'REVIEW',
}

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum Status {
  RECEIVED = 'RECEIVED',
  VALIDATED = 'VALIDATED',
  ROUTED = 'ROUTED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum OutputFormat {
  TEXT = 'TEXT',
  MARKDOWN = 'MARKDOWN',
  JSON = 'JSON',
  PYTHON = 'PYTHON',
  HTML = 'HTML',
  PDF = 'PDF',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

// Forward-only status lifecycle
const STATUS_ORDER = [
  Status.RECEIVED,
  Status.VALIDATED,
  Status.ROUTED,
  Status.EXECUTING,
  Status.COMPLETED,
];

export function canAdvanceStatus(current: Status, next: Status): boolean {
  const ci = STATUS_ORDER.indexOf(current);
  const ni = STATUS_ORDER.indexOf(next);
  return ci >= 0 && ni >= 0 && ni > ci;
}
