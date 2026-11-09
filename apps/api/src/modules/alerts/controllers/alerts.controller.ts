import type { Request, Response } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { memberOrganizationId } from "../../auth/middleware/auth.middleware.js";
import { alertsService } from "../services/alerts.service.js";

type IdRequest = Request<{ id: string }>;

export function alertsController(db: PrismaClient, options: Parameters<typeof alertsService>[1]) {
  const alerts = alertsService(db, options);

  return {
    async overview(req: IdRequest, res: Response) {
      res.json(await alerts.overview(memberOrganizationId(res, req.params.id)));
    },

    async setSlack(req: IdRequest, res: Response) {
      await alerts.setSlack(memberOrganizationId(res, req.params.id), req.body);
      res.status(204).end();
    },

    async sendTest(req: IdRequest, res: Response) {
      res.status(202).json(await alerts.raiseTest(memberOrganizationId(res, req.params.id)));
    },
  };
}
