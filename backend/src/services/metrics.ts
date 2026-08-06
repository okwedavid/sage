/**
 * services/metrics.ts
 * OWNS: In-memory request metrics (monitoring hooks)
 *
 * Counters reset on restart — adequate for a single instance / beta. For
 * horizontal scale-out, back this with Redis or a metrics service (P2).
 */
export interface EndpointMetric {
  endpoint: string;
  requests: number;
  errors: number;
  avgLatencyMs: number;
}

export interface WorkerMetric {
  worker: string;
  runs: number;
  errors: number;
  avgLatencyMs: number;
}

export class MetricsStore {
  readonly startedAt: number = Date.now();
  private endpoints = new Map<string, { count: number; errors: number; totalLatencyMs: number }>();
  private workers = new Map<string, { count: number; errors: number; totalLatencyMs: number }>();

  record(endpoint: string, statusCode: number, latencyMs: number): void {
    const entry = this.endpoints.get(endpoint) || { count: 0, errors: 0, totalLatencyMs: 0 };
    entry.count += 1;
    entry.totalLatencyMs += latencyMs;
    if (statusCode >= 400) entry.errors += 1;
    this.endpoints.set(endpoint, entry);
  }

  snapshot(): {
    uptimeSec: number;
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    endpoints: EndpointMetric[];
    workers: WorkerMetric[];
  } {
    let totalRequests = 0;
    let totalErrors = 0;

    const endpoints: EndpointMetric[] = [];
    for (const [endpoint, e] of this.endpoints) {
      totalRequests += e.count;
      totalErrors += e.errors;
      endpoints.push({
        endpoint,
        requests: e.count,
        errors: e.errors,
        avgLatencyMs: e.count ? Math.round(e.totalLatencyMs / e.count) : 0,
      });
    }

    return {
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
      totalRequests,
      totalErrors,
      errorRate: totalRequests ? Math.round((totalErrors / totalRequests) * 1000) / 10 : 0,
      endpoints: endpoints.sort((a, b) => b.requests - a.requests),
      workers: this.workerSnapshot(),
    };
  }

  /** Record one worker execution (latency + success/failure). */
  recordWorker(worker: string, ok: boolean, latencyMs: number): void {
    const entry = this.workers.get(worker) || { count: 0, errors: 0, totalLatencyMs: 0 };
    entry.count += 1;
    entry.totalLatencyMs += latencyMs;
    if (!ok) entry.errors += 1;
    this.workers.set(worker, entry);
  }

  private workerSnapshot(): WorkerMetric[] {
    const out: WorkerMetric[] = [];
    for (const [worker, e] of this.workers) {
      out.push({
        worker,
        runs: e.count,
        errors: e.errors,
        avgLatencyMs: e.count ? Math.round(e.totalLatencyMs / e.count) : 0,
      });
    }
    return out.sort((a, b) => b.runs - a.runs);
  }
}

export const metrics = new MetricsStore();
