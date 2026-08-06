/**
 * core/intent/router.test.ts — Unit tests for intent routing
 */
import { describe, it, expect } from 'vitest';
import { IntentRouter } from './router';
import { createIntent } from './schemas';
import { AgentRegistry } from '../../agents/registry';
import { TaskType, Status } from '../enums';

function buildRegistry() {
  const registry = new AgentRegistry();
  const stubWorker = { execute: async () => 'stub response' };
  registry.registerWorker('GeneralWorker', stubWorker as any);
  registry.registerWorker('WebWorker', stubWorker as any);
  registry.registerWorker('VisionWorker', stubWorker as any);
  return registry;
}

describe('IntentRouter', () => {
  it('routes image attachments to VisionWorker (priority 1)', () => {
    const router = new IntentRouter(buildRegistry());
    const intent = createIntent({
      inputText: 'Analyze this image',
      taskType: TaskType.ANALYZE,
      targetDomain: 'Computer Vision',
      confidenceScore: 0.9,
      attachments: { image_base64: 'aGVsbG8=', image_type: 'png' },
      status: Status.VALIDATED,
    });

    const { agentName, updatedIntent } = router.route(intent);
    expect(agentName).toBe('VisionWorker');
    expect(updatedIntent.suggestedAgent).toBe('VisionWorker');
    expect(updatedIntent.status).toBe(Status.ROUTED);
  });

  it('routes RESEARCH to WebWorker via registry lookup', () => {
    const router = new IntentRouter(buildRegistry());
    const intent = createIntent({
      inputText: 'Research https://example.com',
      taskType: TaskType.RESEARCH,
      targetDomain: 'Web',
      confidenceScore: 0.9,
      status: Status.VALIDATED,
    });

    const { agentName, worker } = router.route(intent);
    expect(agentName).toBe('WebWorker');
    expect(worker).toBeTruthy();
  });

  it('routes default MARKDOWN tasks to GeneralWorker', () => {
    const router = new IntentRouter(buildRegistry());
    const intent = createIntent({
      inputText: 'Explain quantum computing',
      taskType: TaskType.EXPLAIN,
      targetDomain: 'Physics',
      confidenceScore: 0.9,
      status: Status.VALIDATED,
    });

    const { agentName } = router.route(intent);
    expect(agentName).toBe('GeneralWorker');
  });

  it('throws when intent is not VALIDATED', () => {
    const router = new IntentRouter(buildRegistry());
    const intent = createIntent({
      inputText: 'x',
      taskType: TaskType.REVIEW,
      targetDomain: 'General',
      confidenceScore: 0.9,
      status: Status.RECEIVED,
    });

    expect(() => router.route(intent)).toThrow(/VALIDATED/);
  });

  it('throws when no workers are registered', () => {
    const router = new IntentRouter(new AgentRegistry());
    const intent = createIntent({
      inputText: 'x',
      taskType: TaskType.REVIEW,
      targetDomain: 'General',
      confidenceScore: 0.9,
      status: Status.VALIDATED,
    });

    expect(() => router.route(intent)).toThrow(/No workers available/);
  });
});
