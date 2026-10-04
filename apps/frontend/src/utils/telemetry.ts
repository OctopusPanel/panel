/**
 * Normalizes daemon `stats` payloads into the panel metrics shape.
 * Both the page-level telemetry socket and the console socket use this, so they can
 * never write conflicting values into the store. Fields missing from a payload keep
 * their previous value instead of dropping to 0.
 */
export interface ServerMetrics {
  cpuCurrent: number;
  memoryCurrentBytes: number;
  diskCurrentBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  uptimeSeconds: number;
  receivedAt: number;
}

function pick(...values: unknown[]): number | undefined {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

export function mapDaemonStats(stats: any, previous?: Partial<ServerMetrics> | null): ServerMetrics {
  const prev = previous || {};
  const uptimeMs = pick(stats?.uptimeMs, stats?.uptime_ms);

  return {
    cpuCurrent: pick(stats?.cpu_usage_pct, stats?.cpu_absolute, stats?.cpuAbsolute, stats?.cpu_percentage) ?? prev.cpuCurrent ?? 0,
    memoryCurrentBytes: pick(stats?.memory_bytes, stats?.memoryBytes) ?? prev.memoryCurrentBytes ?? 0,
    diskCurrentBytes: pick(stats?.disk_bytes, stats?.diskBytes) ?? prev.diskCurrentBytes ?? 0,
    networkRxBytes: pick(stats?.network_rx_bytes, stats?.network?.rx_bytes, stats?.networkRxBytes) ?? prev.networkRxBytes ?? 0,
    networkTxBytes: pick(stats?.network_tx_bytes, stats?.network?.tx_bytes, stats?.networkTxBytes) ?? prev.networkTxBytes ?? 0,
    uptimeSeconds:
      pick(stats?.uptime_secs, stats?.uptimeSeconds, stats?.uptime, uptimeMs !== undefined ? Math.floor(uptimeMs / 1000) : undefined) ??
      prev.uptimeSeconds ??
      0,
    receivedAt: Date.now(),
  };
}
