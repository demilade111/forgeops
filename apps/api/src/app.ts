import express from "express";
import type { PrismaClient } from "./database/prisma-client/client.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requireJson } from "./middleware/require-json.js";
import { createAlertsRouter } from "./modules/alerts/routes/alerts.routes.js";
import { createAuthRouter } from "./modules/auth/routes/auth.routes.js";
import { createDeploymentsRouter } from "./modules/deployments/routes/deployments.routes.js";
import type { GitHubClient } from "./modules/github/clients/github.client.js";
import { createGitHubRouter } from "./modules/github/routes/github.routes.js";
import { createProjectsRouter } from "./modules/projects/routes/projects.routes.js";

type AppOptions = {
  db: PrismaClient;
  secureCookies?: boolean;
  checkDb?: () => Promise<unknown>;
  github?: GitHubClient | null;
  encryptionKey?: Buffer | null;
  emailAlerts?: boolean;
};

export function createApp({
  db,
  secureCookies = false,
  checkDb = () => db.$queryRaw`SELECT 1`,
  github = null,
  encryptionKey = null,
  emailAlerts = false,
}: AppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/health/ready", async (_req, res) => {
    try {
      await checkDb();
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/api", requireJson);
  app.use("/api", createAuthRouter(db, { secureCookies }));
  app.use("/api", createGitHubRouter(db, github, { secureCookies }));
  app.use("/api", createDeploymentsRouter(db));
  app.use("/api", createProjectsRouter(db, github, encryptionKey));
  app.use("/api", createAlertsRouter(db, { encryptionKey, emailEnabled: emailAlerts }));
  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
  });
  app.use(errorHandler);

  return app;
}
