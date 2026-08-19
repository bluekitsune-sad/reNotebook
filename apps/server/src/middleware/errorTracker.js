import { logger } from '../utils/logger.js';
import { recordError } from '../utils/metrics.js';

const SENSITIVE_PATTERNS = [
  /password/gi,
  /token/gi,
  /authorization/gi,
  /secret/gi,
  /cookie/gi,
];

function sanitizeValue(key, value) {
  if (typeof value === 'string' && SENSITIVE_PATTERNS.some(p => p.test(key))) {
    return '[REDACTED]';
  }
  if (typeof value === 'object' && value !== null) {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => typeof item === 'object' ? sanitizeObject(item) : item);
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(key, value);
  }
  return sanitized;
}

export function errorTracker(err, req, res, next) {
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  recordError(endpoint);

  const sanitizedBody = req.body ? sanitizeObject(req.body) : {};

  logger.error(JSON.stringify({
    type: 'unhandled_error',
    endpoint,
    status: err.statusCode || 500,
    message: err.message,
    code: err.code,
    requestId: req.headers['x-request-id'],
    timestamp: new Date().toISOString(),
    ...(req.method !== 'GET' && { body: sanitizedBody }),
  }));

  if (process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
  }

  next(err);
}
