export const CATALOG_TIMEOUT_MS = 8000;

// Bound the whole operation, including any wait for the auth client's lock.
// Aborting fetch alone does not guarantee the query promise settles in time.
export function catalogRequest<T>(request: (signal: AbortSignal) => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (complete: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      complete();
    };
    const cancel = () => {
      settle(() => reject(new DOMException("Catalog request cancelled", "AbortError")));
      controller.abort();
    };
    const timer = setTimeout(() => {
      settle(() => reject(new Error("Catalog request timed out")));
      controller.abort();
    }, CATALOG_TIMEOUT_MS);
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener("abort", cancel, { once: true });
    Promise.resolve().then(() => request(controller.signal)).then(
      (result) => settle(() => resolve(result)),
      (error) => settle(() => reject(error)),
    );
  });
}
