// Also bound SDK auth-lock waits, which do not consume the fetch AbortSignal.
export function withAbort<T>(operation: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new DOMException("Request cancelled", "AbortError")); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
      return operation();
    }).then(value => { signal.removeEventListener("abort", abort); resolve(value); },
      error => { signal.removeEventListener("abort", abort); reject(error); });
  });
}

export const CHAT_DEADLINE_MS = 35_000;
export const CONFIRM_DEADLINE_MS = 10_000;

/** One deadline for the complete operation, including auth, tools and all model rounds. */
export async function withRequestDeadline<T>(parent: AbortSignal, timeoutMs: number, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  parent.addEventListener("abort", cancel, { once: true });
  if (parent.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  try { return await withAbort(() => operation(controller.signal), controller.signal); }
  finally { clearTimeout(timer); parent.removeEventListener("abort", cancel); }
}
