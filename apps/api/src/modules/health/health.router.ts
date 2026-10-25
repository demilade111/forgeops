import { Router } from "express";

export type ReadinessCheck = {
  name: string;
  check: () => Promise<void>;
};

export type HealthRouterOptions = {
  readinessChecks: ReadinessCheck[];
  checkTimeoutMs: number;
};

type CheckResult = { name: string; status: "ok" | "fail" };

async function runCheck({ name, check }: ReadinessCheck, timeoutMs: number): Promise<CheckResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${name} timed out`)), timeoutMs);
  });

  try {
    await Promise.race([check(), timeout]);
    return { name, status: "ok" };
  } catch {
    return { name, status: "fail" };
  } finally {
    clearTimeout(timer);
  }
}

export function createHealthRouter({
  readinessChecks,
  checkTimeoutMs,
}: HealthRouterOptions): Router {
  const router = Router();

  router.get("/live", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  router.get("/ready", async (_req, res) => {
    const checks = await Promise.all(readinessChecks.map((c) => runCheck(c, checkTimeoutMs)));
    const ready = checks.every((c) => c.status === "ok");

    res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "unavailable", checks });
  });

  return router;
}
