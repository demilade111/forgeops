import { Router } from "express";
import type { PrismaClient } from "../../database/prisma-client/client.js";
import { parse } from "../../lib/http-error.js";
import {
  createRequireAuth,
  memberOrganizationId,
  memberOrganizationIds,
} from "../auth/auth.middleware.js";
import type { GitHubClient } from "../github/github.client.js";
import { projectBody } from "./projects.schema.js";
import { projectsService } from "./projects.service.js";

export function createProjectsRouter(
  db: PrismaClient,
  github: GitHubClient | null,
  encryptionKey: Buffer | null,
) {
  const projects = projectsService(db, github, encryptionKey);
  const router = Router();

  router.use(["/projects", "/services"], createRequireAuth(db));

  router.post("/projects", async (req, res) => {
    const { organizationId, name } = parse(projectBody, req.body);
    res
      .status(201)
      .json(await projects.createProject(memberOrganizationId(res, organizationId), name));
  });

  router.get("/projects", async (req, res) => {
    res.json(await projects.listProjects(memberOrganizationId(res, req.query.organizationId)));
  });

  router.get("/projects/:id", async (req, res) => {
    res.json(await projects.getProject(req.params.id, memberOrganizationIds(res)));
  });

  router.post("/projects/:id/services", async (req, res) => {
    res
      .status(201)
      .json(await projects.createService(req.params.id, memberOrganizationIds(res), req.body));
  });

  router.get("/services/:id", async (req, res) => {
    res.json(await projects.getService(req.params.id, memberOrganizationIds(res)));
  });

  router.patch("/services/:id", async (req, res) => {
    res.json(await projects.updateService(req.params.id, memberOrganizationIds(res), req.body));
  });

  router.delete("/projects/:id", async (req, res) => {
    await projects.deleteProject(req.params.id, memberOrganizationIds(res));
    res.sendStatus(202);
  });

  router.delete("/services/:id", async (req, res) => {
    await projects.deleteService(req.params.id, memberOrganizationIds(res));
    res.sendStatus(202);
  });

  return router;
}
