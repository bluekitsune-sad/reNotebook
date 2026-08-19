import { logger } from '../utils/logger.js';
import { recordRequest } from '../utils/metrics.js';

const SKIP_PATHS = ['/api/health', '/api/ready', '/api/metrics'];

export function requestLogger(req, res, next) {
  if (SKIP_PATHS.includes(req.path)) {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const entry = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
    };

    recordRequest();

    if (res.statusCode >= 500) {
      logger.error(JSON.stringify(entry));
    } else if (res.statusCode >= 400) {
      logger.warn(JSON.stringify(entry));
    } else {
      logger.info(JSON.stringify(entry));
    }
  });

  next();
}
