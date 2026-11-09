import { Router } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { createRequireAuth } from "../../auth/middleware/auth.middleware.js";
import type { GitHubClient } from "../../github/clients/github.client.js";
import { projectsController } from "../controllers/projects.controller.js";

export function createProjectsRouter(
  db: PrismaClient,
  github: GitHubClient | null,
  encryptionKey: Buffer | null,
) {
  const projects = projectsController(db, github, encryptionKey);
  const router = Router();

  router.use(["/projects", "/services"], createRequireAuth(db));

  router.post("/projects", projects.createProject);
  router.get("/projects", projects.listProjects);
  router.get("/projects/:id", projects.getProject);
  router.delete("/projects/:id", projects.deleteProject);
  router.post("/projects/:id/services", projects.createService);
  router.get("/services/:id", projects.getService);
  router.patch("/services/:id", projects.updateService);
  router.delete("/services/:id", projects.deleteService);

  return router;
}
