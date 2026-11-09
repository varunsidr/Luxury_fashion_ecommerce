export async function readAdminData(path: string, timeoutMs = 8_000): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Loading timed out. Please retry."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetch(path, { cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Could not load data. Please retry.");
      if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid response. Please retry.");
      return result;
    })()]);
  } finally {
    clearTimeout(timer);
  }
}
