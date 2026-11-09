import { z } from "zod";
import { Prisma, type PrismaClient } from "../../../database/prisma-client/client.js";
import { HttpError, isId, parse } from "../../../lib/http-error.js";
import {
  deploymentsRepository,
  type RollbackTarget,
} from "../repositories/deployments.repository.js";

const idempotencyKey = z
  .string({ error: "Idempotency-Key header is required" })
  .regex(
    /^[\w.:-]{1,255}$/,
    "Idempotency-Key must be 1 to 255 letters, numbers, dashes, dots, colons or underscores",
  );

const logLines = z.coerce
  .number({ error: "lines must be a number" })
  .int("lines must be a whole number")
  .min(1, "lines must be between 1 and 1000")
  .max(1000, "lines must be between 1 and 1000")
  .default(200);

const metricMinutes = z.coerce
  .number({ error: "minutes must be a number" })
  .int("minutes must be a whole number")
  .min(5, "minutes must be between 5 and 1440")
  .max(1440, "minutes must be between 5 and 1440")
  .default(60);

export function deploymentsService(db: PrismaClient) {
  const repo = deploymentsRepository(db);

  async function replayOrConflict(serviceId: string, key: string) {
    const existing = await repo.findByKey(serviceId, key);
    if (existing) return existing;
    const active = await repo.findActive(serviceId);
    throw new HttpError(
      409,
      "DEPLOYMENT_IN_PROGRESS",
      `Deployment ${active?.id ?? "for this service"} is still in progress`,
    );
  }

  async function find(id: string, organizationIds: string[]) {
    const deployment = isId(id) ? await repo.find(id, organizationIds) : null;
    if (!deployment) throw new HttpError(404, "DEPLOYMENT_NOT_FOUND", "Deployment not found");
    return deployment;
  }

  async function start(serviceId: string, userId: string, rawKey: unknown, to?: RollbackTarget) {
    const key = parse(idempotencyKey, rawKey);
    const existing = await repo.findByKey(serviceId, key);
    if (existing) return existing;
    try {
      const deployment = await repo.create(serviceId, userId, key, to);
      if (!deployment) throw new HttpError(404, "SERVICE_NOT_FOUND", "Service not found");
      return deployment;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return replayOrConflict(serviceId, key);
      }
      throw error;
    }
  }

  return {
    find,
    start,

    async rollback(id: string, organizationIds: string[], userId: string, rawKey: unknown) {
      const target = await find(id, organizationIds);
      if (target.status !== "succeeded" || !target.image) {
        throw new HttpError(
          409,
          "NOT_ROLLBACK_TARGET",
          "You can only roll back to a successful deploy",
        );
      }
      if ((await repo.findLive(target.serviceId))?.id === target.id) {
        throw new HttpError(409, "ALREADY_LIVE", "This deploy is already live");
      }
      return start(target.serviceId, userId, rawKey, { ...target, image: target.image });
    },

    list: (serviceId: string) => repo.list(serviceId),

    async metrics(serviceId: string, rawMinutes: unknown) {
      const minutes = parse(metricMinutes, rawMinutes);
      const rows = await repo.samples(serviceId, new Date(Date.now() - minutes * 60_000));
      return {
        minutes,
        samples: rows.map((r) => ({
          takenAt: r.takenAt,
          cpuPercent: r.cpuPercent,
          memoryBytes: Number(r.memoryBytes),
          memoryLimit: Number(r.memoryLimit),
        })),
      };
    },

    async logs(serviceId: string, rawLines: unknown) {
      const lines = parse(logLines, rawLines);
      const live = await repo.findLive(serviceId);
      if (!live) return { deploymentId: null, running: false, log: "" };
      const saved = await repo.appLog(live.id);
      if (!saved) return { deploymentId: live.id, running: true, log: "" };
      const log = saved.log.trimEnd().split("\n").slice(-lines).join("\n");
      return { deploymentId: live.id, running: saved.running, log };
    },
  };
}
