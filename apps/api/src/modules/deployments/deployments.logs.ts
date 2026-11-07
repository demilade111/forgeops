import type { PrismaClient } from "../../generated/prisma/client.js";
import { run } from "./deployments.build.js";
import { deploymentsRepository } from "./deployments.repository.js";

export function createLogCollector(db: PrismaClient, lines = 1000) {
  const repo = deploymentsRepository(db);
  return async function collect() {
    const ps = await run(
      "docker",
      ["ps", "-a", "--filter", "name=^fo-", "--format", "{{.Names}}|{{.State}}"],
      30_000,
    );
    if (ps.code !== 0) throw new Error(`docker ps failed: ${ps.log}`);
    const states = new Map(
      ps.log
        .trim()
        .split("\n")
        .map((line) => line.split("|") as [string, string]),
    );
    const logs = await Promise.all(
      (await repo.allLive()).map(async ({ id, serviceId }) => {
        const state = states.get(`fo-${id}`);
        if (!state) return { deploymentId: id, serviceId, running: false, log: "" };
        const out = await run(
          "docker",
          ["logs", "--tail", String(lines), "--timestamps", `fo-${id}`],
          10_000,
        );
        if (out.log.includes("No such container")) {
          return { deploymentId: id, serviceId, running: false, log: "" };
        }
        if (out.code !== 0) throw new Error(`docker logs failed for fo-${id}: ${out.log}`);
        return { deploymentId: id, serviceId, running: state === "running", log: out.log };
      }),
    );
    await repo.saveAppLogs(logs);
  };
}
