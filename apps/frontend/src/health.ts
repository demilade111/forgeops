export type Health = "loading" | "healthy" | "database-down" | "api-down";

export async function checkHealth(timeoutMs = 3000): Promise<Health> {
  try {
    const res = await fetch("/health/ready", { signal: AbortSignal.timeout(timeoutMs) });
    if (res.ok) return "healthy";
    return res.status === 503 ? "database-down" : "api-down";
  } catch {
    return "api-down";
  }
}
