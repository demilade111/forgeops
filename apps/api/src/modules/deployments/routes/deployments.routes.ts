import { Router } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { createRequireAuth } from "../../auth/middleware/auth.middleware.js";
import { deploymentsController } from "../controllers/deployments.controller.js";

export function createDeploymentsRouter(db: PrismaClient) {
  const deployments = deploymentsController(db);
  const router = Router();

  router.use(
    ["/services/:id/deployments", "/services/:id/logs", "/services/:id/metrics", "/deployments"],
    createRequireAuth(db),
  );

  router.post("/services/:id/deployments", deployments.start);
  router.get("/services/:id/deployments", deployments.list);
  router.get("/services/:id/metrics", deployments.metrics);
  router.get("/services/:id/logs", deployments.logs);
  router.get("/deployments/:id", deployments.find);
  router.post("/deployments/:id/rollback", deployments.rollback);

  return router;
}
