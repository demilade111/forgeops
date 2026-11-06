import type { Deployment } from "@/types";

export const isActive = (d: Deployment | null | undefined) =>
  d?.status === "queued" || d?.status === "running";

export function serviceState(history: Deployment[]) {
  const latest = history[0];
  if (isActive(latest)) return "running" as const;
  if (latest?.status === "failed") return "failed" as const;
  return history.some((d) => d.status === "succeeded") ? ("live" as const) : null;
}
