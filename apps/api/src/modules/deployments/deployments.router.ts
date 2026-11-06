import { Router, type Response } from "express";
import { z } from "zod";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { HttpError, isId, parse } from "../../http-error.js";
import { run } from "./deployments.build.js";
import { createRequireAuth, memberOrganizationIds, type SessionUser } from "../auth/auth.router.js";
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
    ["/services/:id/deployments", "/services/:id/logs", "/deployments"],
    createRequireAuth(db),
  );

  router.post("/services/:id/deployments", async (req, res) => {
    const service = await findService(res, req.params.id);
    const key = parse(idempotencyKey, req.get("Idempotency-Key"));
    const existing = await repo.findByKey(service.id, key);
    if (existing) return res.status(202).json(existing);
    try {
      const { id: userId } = res.locals.user as SessionUser;
      const deployment = await repo.create(service.id, userId, key);
      if (!deployment) throw new HttpError(404, "SERVICE_NOT_FOUND", "Service not found");
      res.status(202).json(deployment);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(202).json(await replayOrConflict(service.id, key));
      }
      throw error;
    }
  });

  router.get("/services/:id/deployments", async (req, res) => {
    const service = await findService(res, req.params.id);
    res.json(await repo.list(service.id));
  });

  router.get("/services/:id/logs", async (req, res) => {
    const service = await findService(res, req.params.id);
    const lines = parse(logLines, req.query.lines);
    const live = await repo.findLive(service.id);
    if (!live) return res.json({ deploymentId: null, running: false, log: "" });
    const result = await run(
      "docker",
      ["logs", "--tail", String(lines), "--timestamps", `fo-${live.id}`],
      10_000,
    ).catch(() => null);
    if (result?.code === 0)
      return res.json({ deploymentId: live.id, running: true, log: result.log });
    if (result?.log.includes("No such container")) {
      return res.json({ deploymentId: live.id, running: false, log: "" });
    }
    throw new HttpError(503, "LOGS_UNAVAILABLE", "Logs are not available right now. Try again.");
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
