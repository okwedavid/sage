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

export class MetricsStore {
  readonly startedAt: number = Date.now();
  private endpoints = new Map<string, { count: number; errors: number; totalLatencyMs: number }>();

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
  } {
    let totalRequests = 0;
    let totalErrors = 0;
    let totalLatencyMs = 0;

    const endpoints: EndpointMetric[] = [];
    for (const [endpoint, e] of this.endpoints) {
      totalRequests += e.count;
      totalErrors += e.errors;
      totalLatencyMs += e.totalLatencyMs;
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
    };
  }
}

export const metrics = new MetricsStore();
