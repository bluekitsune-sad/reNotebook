import { Router } from 'express';
import { checkMongoConnection, getMemoryUsage, getUptime, getProcessInfo } from '../utils/healthCheck.js';
import { getMetrics } from '../utils/metrics.js';

const router = Router();

router.get('/health', (req, res) => {
  const { processUptime, systemUptime } = getUptime();
  const memory = getMemoryUsage();
  const processInfo = getProcessInfo();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: processUptime,
    systemUptime,
    memory,
    version: processInfo.version,
    pid: processInfo.pid,
    nodeVersion: processInfo.nodeVersion,
    env: processInfo.env,
  });
});

router.get('/ready', async (req, res) => {
  const mongo = await checkMongoConnection();
  if (mongo.healthy) {
    res.json({ status: 'ready', mongo: mongo.state });
  } else {
    res.status(503).json({ status: 'not ready', mongo: mongo.state, error: mongo.error });
  }
});

router.get('/metrics', (req, res) => {
  const mem = getMemoryUsage();
  const { processUptime } = getUptime();
  const processInfo = getProcessInfo();

  const customMetrics = getMetrics();
  const promMetrics = [
    `# HELP process_uptime_seconds Process uptime in seconds`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${process.uptime().toFixed(2)}`,
    ``,
    `# HELP process_memory_rss_bytes Resident set size in bytes`,
    `# TYPE process_memory_rss_bytes gauge`,
    `process_memory_rss_bytes ${parseInt(mem.rss) * 1024 * 1024}`,
    ``,
    `# HELP process_memory_heap_used_bytes Heap used in bytes`,
    `# TYPE process_memory_heap_used_bytes gauge`,
    `process_memory_heap_used_bytes ${parseInt(mem.heapUsed) * 1024 * 1024}`,
    ``,
    `# HELP process_memory_heap_total_bytes Heap total in bytes`,
    `# TYPE process_memory_heap_total_bytes gauge`,
    `process_memory_heap_total_bytes ${parseInt(mem.heapTotal) * 1024 * 1024}`,
    ``,
    `# HELP app_node_version Node.js version`,
    `# TYPE app_node_version gauge`,
    `app_node_version{version="${processInfo.nodeVersion}"} 1`,
    ``,
    `# HELP app_version Application version`,
    `# TYPE app_version gauge`,
    `app_version{version="${processInfo.version}"} 1`,
  ].join('\n');

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(customMetrics + '\n' + promMetrics);
});

export default router;
