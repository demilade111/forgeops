import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { run } from "./deployments.build.js";
import { deploymentsRepository } from "../repositories/deployments.repository.js";

const units: Record<string, number> = {
  B: 1,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
  kB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
};

const bytes = (text = "") => {
  const match = /^([\d.]+)\s*([A-Za-z]+)$/.exec(text.trim());
  return match && units[match[2]!] ? Math.round(Number(match[1]) * units[match[2]!]!) : NaN;
};

export function parseStats(output: string) {
  return output.split("\n").flatMap((line) => {
    const [name, cpu, memory] = line.split("|");
    const [used, limit] = (memory ?? "").split("/");
    const sample = {
      container: name?.trim() ?? "",
      cpuPercent: parseFloat(cpu ?? ""),
      memoryBytes: bytes(used),
      memoryLimit: bytes(limit),
    };
    const valid = [sample.cpuPercent, sample.memoryBytes, sample.memoryLimit].every(
      Number.isFinite,
    );
    return sample.container.startsWith("fo-") && valid ? [sample] : [];
  });
}

export function createMetricsCollector(db: PrismaClient, keepMs = 24 * 60 * 60_000) {
  const repo = deploymentsRepository(db);
  return async function collect() {
    const stats = await run(
      "docker",
      ["stats", "--no-stream", "--format", "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}"],
      30_000,
    );
    if (stats.code !== 0) throw new Error(`docker stats failed: ${stats.log}`);
    const samples = parseStats(stats.log);
    const ids = samples.map((s) => s.container.slice(3)).filter((id) => /^[0-9a-f-]{36}$/.test(id));
    const live = await repo.liveAmong(ids);
    const takenAt = new Date();
    await repo.saveSamples(
      live.map(({ id, serviceId }) => {
        const s = samples.find((x) => x.container === `fo-${id}`)!;
        return {
          serviceId,
          deploymentId: id,
          cpuPercent: s.cpuPercent,
          memoryBytes: BigInt(s.memoryBytes),
          memoryLimit: BigInt(s.memoryLimit),
          takenAt,
        };
      }),
    );
    await repo.pruneSamples(new Date(Date.now() - keepMs));
  };
}
