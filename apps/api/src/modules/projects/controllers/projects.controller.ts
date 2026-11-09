import type { Request, Response } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { parse } from "../../../lib/http-error.js";
import {
  memberOrganizationId,
  memberOrganizationIds,
} from "../../auth/middleware/auth.middleware.js";
import type { GitHubClient } from "../../github/clients/github.client.js";
import { projectBody } from "../schemas/projects.schema.js";
import { projectsService } from "../services/projects.service.js";

type IdRequest = Request<{ id: string }>;

export function projectsController(
  db: PrismaClient,
  github: GitHubClient | null,
  encryptionKey: Buffer | null,
) {
  const projects = projectsService(db, github, encryptionKey);

  return {
    async createProject(req: Request, res: Response) {
      const { organizationId, name } = parse(projectBody, req.body);
      res
        .status(201)
        .json(await projects.createProject(memberOrganizationId(res, organizationId), name));
    },

    async listProjects(req: Request, res: Response) {
      res.json(await projects.listProjects(memberOrganizationId(res, req.query.organizationId)));
    },

    async getProject(req: IdRequest, res: Response) {
      res.json(await projects.getProject(req.params.id, memberOrganizationIds(res)));
    },

    async deleteProject(req: IdRequest, res: Response) {
      await projects.deleteProject(req.params.id, memberOrganizationIds(res));
      res.sendStatus(202);
    },

    async createService(req: IdRequest, res: Response) {
      res
        .status(201)
        .json(await projects.createService(req.params.id, memberOrganizationIds(res), req.body));
    },

    async getService(req: IdRequest, res: Response) {
      res.json(await projects.getService(req.params.id, memberOrganizationIds(res)));
    },

    async updateService(req: IdRequest, res: Response) {
      res.json(await projects.updateService(req.params.id, memberOrganizationIds(res), req.body));
    },

    async deleteService(req: IdRequest, res: Response) {
      await projects.deleteService(req.params.id, memberOrganizationIds(res));
      res.sendStatus(202);
    },
  };
}
