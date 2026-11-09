import { Router } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { createRequireAuth } from "../../auth/middleware/auth.middleware.js";
import { alertsController } from "../controllers/alerts.controller.js";

export function createAlertsRouter(
  db: PrismaClient,
  options: { encryptionKey: Buffer | null; emailEnabled: boolean },
) {
  const alerts = alertsController(db, options);
  const router = Router();

  router.use("/organizations/:id/alerts", createRequireAuth(db));
  router.get("/organizations/:id/alerts", alerts.overview);
  router.put("/organizations/:id/alerts/slack", alerts.setSlack);
  router.post("/organizations/:id/alerts/test", alerts.sendTest);

  return router;
}
