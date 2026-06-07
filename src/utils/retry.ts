import { logger } from './logger.js';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  factor?: number;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Generic retry wrapper with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxAttempts: 3, baseDelay: 1000 },
): Promise<T> {
  const { maxAttempts, baseDelay, factor = 2 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(factor, attempt - 1);
        logger.warn(
          { attempt, maxAttempts, delay, error: lastError.message },
          'Operation failed, retrying with backoff',
        );
        await sleep(delay);
      }
    }
  }

  throw new RetryError(
    `Operation failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastError!,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
