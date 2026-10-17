/**
 * Prometheus metrics tracker for Sketchboard cluster monitoring.
 * Exposes connected sockets, active boards, updates/sec, ack latency, and adapter errors.
 */
class MetricsCollector {
  public connectedSockets = 0;
  public activeBoards = 0;
  public updatesTotal = 0;
  public redisErrorsTotal = 0;
  private ackLatencies: number[] = [];

  public recordAckLatency(ms: number): void {
    this.ackLatencies.push(ms);
    if (this.ackLatencies.length > 500) {
      this.ackLatencies.shift();
    }
  }

  public getP95AckLatency(): number {
    if (this.ackLatencies.length === 0) return 0;
    const sorted = [...this.ackLatencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return Math.round(sorted[index] * 100) / 100;
  }

  public getMetricsAsPrometheusText(): string {
    const p95Latency = this.getP95AckLatency();
    return [
      '# HELP sketchboard_connected_sockets Current number of active client sockets',
      '# TYPE sketchboard_connected_sockets gauge',
      `sketchboard_connected_sockets ${this.connectedSockets}`,
      '',
      '# HELP sketchboard_active_boards Number of active board sessions in memory',
      '# TYPE sketchboard_active_boards gauge',
      `sketchboard_active_boards ${this.activeBoards}`,
      '',
      '# HELP sketchboard_updates_total Total number of sync:update events processed',
      '# TYPE sketchboard_updates_total counter',
      `sketchboard_updates_total ${this.updatesTotal}`,
      '',
      '# HELP sketchboard_ack_latency_ms_p95 p95 latency in ms to ACK an update',
      '# TYPE sketchboard_ack_latency_ms_p95 gauge',
      `sketchboard_ack_latency_ms_p95 ${p95Latency}`,
      '',
      '# HELP sketchboard_redis_errors_total Total Redis adapter or log errors',
      '# TYPE sketchboard_redis_errors_total counter',
      `sketchboard_redis_errors_total ${this.redisErrorsTotal}`,
      '',
    ].join('\n');
  }
}

export const metrics = new MetricsCollector();
