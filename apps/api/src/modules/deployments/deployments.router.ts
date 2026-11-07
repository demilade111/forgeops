import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { HttpError, isId, parse } from "../../http-error.js";
import { createRequireAuth, memberOrganizationIds, type SessionUser } from "../auth/auth.router.js";
import type { RollbackTarget } from "./deployments.repository.js";
import { projectsRepository } from "../projects/projects.repository.js";
import { deploymentsRepository } from "./deployments.repository.js";

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

export function createDeploymentsRouter(db: PrismaClient) {
  const repo = deploymentsRepository(db);
  const projects = projectsRepository(db);
  const router = Router();

  async function findService(res: Response, id: string) {
    const service = isId(id) ? await projects.findService(id, memberOrganizationIds(res)) : null;
    if (!service) throw new HttpError(404, "SERVICE_NOT_FOUND", "Service not found");
    return service;
  }

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

  router.use(
    ["/services/:id/deployments", "/services/:id/logs", "/services/:id/metrics", "/deployments"],
    createRequireAuth(db),
  );

  async function start(req: Request, res: Response, serviceId: string, to?: RollbackTarget) {
    const key = parse(idempotencyKey, req.get("Idempotency-Key"));
    const existing = await repo.findByKey(serviceId, key);
    if (existing) return res.status(202).json(existing);
    try {
      const { id: userId } = res.locals.user as SessionUser;
      const deployment = await repo.create(serviceId, userId, key, to);
      if (!deployment) throw new HttpError(404, "SERVICE_NOT_FOUND", "Service not found");
      res.status(202).json(deployment);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(202).json(await replayOrConflict(serviceId, key));
      }
      throw error;
    }
  }

  router.post("/services/:id/deployments", async (req, res) => {
    await start(req, res, (await findService(res, req.params.id)).id);
  });

  router.post("/deployments/:id/rollback", async (req, res) => {
    const target = isId(req.params.id)
      ? await repo.find(req.params.id, memberOrganizationIds(res))
      : null;
    if (!target) throw new HttpError(404, "DEPLOYMENT_NOT_FOUND", "Deployment not found");
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
    await start(req, res, target.serviceId, { ...target, image: target.image });
  });

  router.get("/services/:id/deployments", async (req, res) => {
    const service = await findService(res, req.params.id);
    res.json(await repo.list(service.id));
  });

  router.get("/services/:id/metrics", async (req, res) => {
    const service = await findService(res, req.params.id);
    const minutes = parse(metricMinutes, req.query.minutes);
    const rows = await repo.samples(service.id, new Date(Date.now() - minutes * 60_000));
    res.json({
      minutes,
      samples: rows.map((r) => ({
        takenAt: r.takenAt,
        cpuPercent: r.cpuPercent,
        memoryBytes: Number(r.memoryBytes),
        memoryLimit: Number(r.memoryLimit),
      })),
    });
  });

  router.get("/services/:id/logs", async (req, res) => {
    const service = await findService(res, req.params.id);
    const lines = parse(logLines, req.query.lines);
    const live = await repo.findLive(service.id);
    if (!live) return res.json({ deploymentId: null, running: false, log: "" });
    const saved = await repo.appLog(live.id);
    if (!saved) return res.json({ deploymentId: live.id, running: true, log: "" });
    const log = saved.log.trimEnd().split("\n").slice(-lines).join("\n");
    res.json({ deploymentId: live.id, running: saved.running, log });
  });

  router.get("/deployments/:id", async (req, res) => {
    const deployment = isId(req.params.id)
      ? await repo.find(req.params.id, memberOrganizationIds(res))
      : null;
    if (!deployment) throw new HttpError(404, "DEPLOYMENT_NOT_FOUND", "Deployment not found");
    res.json(deployment);
  });

  return router;
}
