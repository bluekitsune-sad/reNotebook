import { logger } from './logger.js';

const counters = {
  sync_requests_total: 0,
  sync_success_total: 0,
  sync_failure_total: 0,
  sync_conflict_total: 0,
  pairing_attempts_total: 0,
  pairing_success_total: 0,
  pairing_failure_total: 0,
  device_revocations_total: 0,
  websocket_connected_total: 0,
  websocket_disconnected_total: 0,
};

const histograms = {
  sync_duration_ms: [],
};

const GAUGE_MAX_SAMPLES = 1000;

function incSyncRequests() {
  counters.sync_requests_total++;
}

function incSyncSuccess() {
  counters.sync_success_total++;
}

function incSyncFailure() {
  counters.sync_failure_total++;
}

function incSyncConflict() {
  counters.sync_conflict_total++;
}

function recordSyncDuration(durationMs) {
  const hist = histograms.sync_duration_ms;
  hist.push(durationMs);
  if (hist.length > GAUGE_MAX_SAMPLES) {
    hist.splice(0, hist.length - GAUGE_MAX_SAMPLES);
  }
}

function incPairingAttempts() {
  counters.pairing_attempts_total++;
}

function incPairingSuccess() {
  counters.pairing_success_total++;
}

function incPairingFailure() {
  counters.pairing_failure_total++;
}

function incDeviceRevocations() {
  counters.device_revocations_total++;
}

function incWebsocketConnected() {
  counters.websocket_connected_total++;
}

function incWebsocketDisconnected() {
  counters.websocket_disconnected_total++;
}

function formatMetrics() {
  const lines = [];

  for (const [key, value] of Object.entries(counters)) {
    lines.push(`# TYPE synced_${key} counter`);
    lines.push(`synced_${key} ${value}`);
  }

  const durations = histograms.sync_duration_ms;
  if (durations.length > 0) {
    const sorted = [...durations].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    lines.push(`# TYPE synced_sync_duration_ms histogram`);
    lines.push(`synced_sync_duration_ms_count ${sorted.length}`);
    lines.push(`synced_sync_duration_ms_sum ${sum.toFixed(2)}`);
    lines.push(`synced_sync_duration_ms_avg ${avg.toFixed(2)}`);
    lines.push(`synced_sync_duration_ms_min ${min}`);
    lines.push(`synced_sync_duration_ms_max ${max}`);
    lines.push(`synced_sync_duration_ms_p50 ${p50}`);
    lines.push(`synced_sync_duration_ms_p95 ${p95}`);
    lines.push(`synced_sync_duration_ms_p99 ${p99}`);
  }

  return lines.join('\n') + '\n';
}

function getMetrics() {
  return {
    counters: { ...counters },
    histograms: {
      sync_duration_ms: {
        count: histograms.sync_duration_ms.length,
        values: [...histograms.sync_duration_ms],
      },
    },
  };
}

function resetMetrics() {
  for (const key of Object.keys(counters)) {
    counters[key] = 0;
  }
  histograms.sync_duration_ms = [];
}

export { getMetrics };

export const metrics = {
  incSyncRequests,
  incSyncSuccess,
  incSyncFailure,
  incSyncConflict,
  recordSyncDuration,
  incPairingAttempts,
  incPairingSuccess,
  incPairingFailure,
  incDeviceRevocations,
  incWebsocketConnected,
  incWebsocketDisconnected,
  formatMetrics,
  getMetrics,
  resetMetrics,
};
