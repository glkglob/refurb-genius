// Lightweight concurrency limiting for parallel operations.
//
// Ensures browser doesn't get overloaded by:
// - Limiting simultaneous operations
// - Queuing excess operations
// - Tracking in-flight operations

export interface ConcurrencyLimiterOptions {
  maxConcurrent: number;
}

export class ConcurrencyLimiter {
  private inFlight = 0;
  private queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  constructor(private readonly maxConcurrent: number) {
    if (maxConcurrent < 1) {
      throw new Error("maxConcurrent must be at least 1");
    }
  }

  /**
   * Queue an async operation. Returns a promise that resolves/rejects
   * when the operation completes.
   *
   * Operations are queued if more than maxConcurrent are already running.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inFlight < this.maxConcurrent) {
      return this.execute(fn);
    }

    // Queue the operation
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
  }

  /**
   * Get current number of in-flight operations.
   */
  getInFlightCount(): number {
    return this.inFlight;
  }

  /**
   * Get current queue length.
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  private async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.inFlight++;
    try {
      return await fn();
    } finally {
      this.inFlight--;
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.queue.length === 0 || this.inFlight >= this.maxConcurrent) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.execute(item.fn).then(item.resolve).catch(item.reject);
  }
}
