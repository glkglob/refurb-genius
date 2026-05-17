// Lightweight timeout and cancellation utilities for long-running operations.
//
// Provides:
// - timeoutPromise: Wrap any promise with a timeout
// - TimeoutError / CancelledError: Standard error types
// - Request lifecycle tracking for observability

export class TimeoutError extends Error {
  readonly name = "TimeoutError";
  readonly isTimeout = true;
  constructor(
    message: string,
    public readonly operationName: string,
    public readonly timeoutMs: number,
  ) {
    super(message);
  }
}

export class CancelledError extends Error {
  readonly name = "CancelledError";
  readonly isCancelled = true;
  constructor(
    message: string,
    public readonly operationName: string,
  ) {
    super(message);
  }
}

/**
 * Wrap a promise to timeout after specified milliseconds.
 * Returns a new promise that rejects with TimeoutError if operation exceeds timeout.
 * The original promise continues in the background but is unobserved.
 */
export function timeoutPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          new TimeoutError(
            `${operationName} exceeded ${timeoutMs}ms timeout`,
            operationName,
            timeoutMs,
          ),
        );
      }, timeoutMs);
    }),
  ]);
}

/**
 * Create an AbortController that times out after specified milliseconds.
 * Useful for long-running operations that support cancellation.
 */
export function createTimeoutAbortController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  return controller;
}

/**
 * Wrap a fetch-like operation with timeout and error mapping.
 * Distinguishes between timeout, abort, and other errors.
 */
export function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  const controller = createTimeoutAbortController(timeoutMs);
  try {
    return fn(controller.signal).catch((err) => {
      if (err instanceof Error && err.name === "AbortError") {
        throw new TimeoutError(`${operationName} aborted (timeout)`, operationName, timeoutMs);
      }
      throw err;
    });
  } catch (err) {
    controller.abort();
    throw err;
  }
}

/**
 * Check if error is a timeout (handles both TimeoutError and AbortError).
 */
export function isTimeoutError(err: unknown): err is TimeoutError | Error {
  if (err instanceof TimeoutError) return true;
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError"))
    return true;
  if (err instanceof Error && err.message.includes("timeout")) return true;
  return false;
}

/**
 * Check if error is a cancellation.
 */
export function isCancelledError(err: unknown): err is CancelledError {
  return err instanceof CancelledError;
}
