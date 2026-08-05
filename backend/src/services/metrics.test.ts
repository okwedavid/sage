/**
 * services/metrics.test.ts — In-memory metrics store
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsStore } from './metrics';

describe('MetricsStore', () => {
  let store: MetricsStore;

  beforeEach(() => {
    store = new MetricsStore();
  });

  it('records requests and aggregates per endpoint', () => {
    store.record('/api/chat', 200, 120);
    store.record('/api/chat', 500, 300);
    store.record('/api/agents', 200, 10);

    const snap = store.snapshot();
    expect(snap.totalRequests).toBe(3);
    expect(snap.totalErrors).toBe(1);
    expect(snap.errorRate).toBe(33.3);

    const chat = snap.endpoints.find((e) => e.endpoint === '/api/chat')!;
    expect(chat.requests).toBe(2);
    expect(chat.errors).toBe(1);
    expect(chat.avgLatencyMs).toBe(210);
  });

  it('returns an empty snapshot for a fresh store', () => {
    const snap = store.snapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.totalErrors).toBe(0);
    expect(snap.errorRate).toBe(0);
    expect(snap.endpoints).toEqual([]);
    expect(typeof snap.uptimeSec).toBe('number');
  });

  it('treats any 4xx/5xx as an error', () => {
    store.record('/api/chat', 429, 5);
    store.record('/api/chat', 404, 5);
    expect(store.snapshot().totalErrors).toBe(2);
  });
});
