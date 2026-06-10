export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(new Error(signal.reason ?? "Request aborted"));
  }

  let timer: NodeJS.Timeout;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error(signal.reason ?? "Request aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      promise.finally(() => signal.removeEventListener("abort", onAbort));
    }
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}
