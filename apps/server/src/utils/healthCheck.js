import mongoose from 'mongoose';

export async function checkMongoConnection() {
  try {
    const state = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    if (state !== 1) {
      return { healthy: false, state: states[state] || 'unknown' };
    }
    await mongoose.connection.db.admin().ping();
    return { healthy: true, state: 'connected' };
  } catch (err) {
    return { healthy: false, state: 'error', error: err.message };
  }
}

export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: `${(usage.rss / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    external: `${(usage.external / 1024 / 1024).toFixed(2)} MB`,
  };
}

export function getUptime() {
  return {
    processUptime: `${process.uptime().toFixed(2)}s`,
    processUptimeMs: process.uptime() * 1000,
    systemUptime: `${require('os').uptime()}s`,
  };
}

export function getProcessInfo() {
  return {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0',
  };
}
