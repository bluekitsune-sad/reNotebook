import { ERROR_CODES } from '@synced-notepad/shared';

const RETRYABLE_ERROR_CODES = new Set([
  ERROR_CODES.NETWORK_ERROR,
  ERROR_CODES.SERVER_ERROR,
  ERROR_CODES.RATE_LIMITED,
]);

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Determine whether an error is safe to retry.
 */
export function isRetryableError(error) {
  if (!error) return false;

  // AppError with a known non-retryable code
  if (error.code && !RETRYABLE_ERROR_CODES.has(error.code)) {
    return false;
  }

  // HTTP status check
  if (error.statusCode) {
    return RETRYABLE_HTTP_STATUSES.has(error.statusCode);
  }

  // Network-level errors (fetch failures, timeouts, DNS)
  if (error.name === 'TypeError' || error.name === 'AbortError') {
    return true;
  }

  // Generic network error
  if (error.message && /network|timeout|fetch|ECONNRESET|ECONNREFUSED|ETIMEDOUT/i.test(error.message)) {
    return true;
  }

  return false;
}

/**
 * Compute delay for attempt number (0-indexed) with exponential backoff + jitter.
 * attempt 0 → ~1000ms, attempt 1 → ~2000ms, etc.
 */
export function computeDelay(attempt, baseDelay = 1000) {
  const exponential = baseDelay * Math.pow(2, attempt);
  const maxDelay = 30_000;
  const capped = Math.min(exponential, maxDelay);
  // Jitter: random value between 50% and 100% of computed delay
  const jitter = capped * (0.5 + Math.random() * 0.5);
  return Math.floor(jitter);
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with retry + exponential backoff.
 *
 * @param {() => Promise<T>} fn - The async operation to retry.
 * @param {Object} [options]
 * @param {number} [options.maxRetries=5] - Maximum number of retries after initial failure.
 * @param {number} [options.baseDelay=1000] - Base delay in ms for backoff calculation.
 * @param {(error: Error, attempt: number) => void} [options.onRetry] - Called before each retry.
 * @returns {Promise<T>}
 * @throws {Error} The last error if all retries exhausted or error is not retryable.
 */
export async function withRetry(fn, { maxRetries = 5, baseDelay = 1000, onRetry } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const delay = computeDelay(attempt, baseDelay);

      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}
