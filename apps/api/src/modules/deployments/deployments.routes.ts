import { Router, type Response } from "express";
import type { PrismaClient } from "../../database/prisma-client/client.js";
import {
  createRequireAuth,
  memberOrganizationIds,
  type SessionUser,
} from "../auth/auth.middleware.js";
import { findOwnedService } from "../projects/projects.service.js";
import { deploymentsService } from "./deployments.service.js";

export function createDeploymentsRouter(db: PrismaClient) {
  const deployments = deploymentsService(db);
  const router = Router();

  const userId = (res: Response) => (res.locals.user as SessionUser).id;
  const ownedService = (res: Response, id: string) =>
    findOwnedService(db, id, memberOrganizationIds(res));

  router.use(
    ["/services/:id/deployments", "/services/:id/logs", "/services/:id/metrics", "/deployments"],
    createRequireAuth(db),
  );

  router.post("/services/:id/deployments", async (req, res) => {
    const service = await ownedService(res, req.params.id);
    res
      .status(202)
      .json(await deployments.start(service.id, userId(res), req.get("Idempotency-Key")));
  });

  router.post("/deployments/:id/rollback", async (req, res) => {
    res
      .status(202)
      .json(
        await deployments.rollback(
          req.params.id,
          memberOrganizationIds(res),
          userId(res),
          req.get("Idempotency-Key"),
        ),
      );
  });

  router.get("/services/:id/deployments", async (req, res) => {
    res.json(await deployments.list((await ownedService(res, req.params.id)).id));
  });

  router.get("/services/:id/metrics", async (req, res) => {
    const service = await ownedService(res, req.params.id);
    res.json(await deployments.metrics(service.id, req.query.minutes));
  });

  router.get("/services/:id/logs", async (req, res) => {
    const service = await ownedService(res, req.params.id);
    res.json(await deployments.logs(service.id, req.query.lines));
  });

  router.get("/deployments/:id", async (req, res) => {
    res.json(await deployments.find(req.params.id, memberOrganizationIds(res)));
  });

  return router;
}
