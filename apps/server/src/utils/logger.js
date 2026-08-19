const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const levels = { error: 0, warn: 1, info: 2, debug: 3 };

export const logger = {
  error: (...args) => levels[LOG_LEVEL] >= 0 && console.error('[ERROR]', new Date().toISOString(), ...args),
  warn: (...args) => levels[LOG_LEVEL] >= 1 && console.warn('[WARN]', new Date().toISOString(), ...args),
  info: (...args) => levels[LOG_LEVEL] >= 2 && console.log('[INFO]', new Date().toISOString(), ...args),
  debug: (...args) => levels[LOG_LEVEL] >= 3 && console.log('[DEBUG]', new Date().toISOString(), ...args),
};
