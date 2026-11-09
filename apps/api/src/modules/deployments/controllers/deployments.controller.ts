import type { Request, Response } from "express";
import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { memberOrganizationIds, sessionUser } from "../../auth/middleware/auth.middleware.js";
import { findOwnedService } from "../../projects/services/projects.service.js";
import { deploymentsService } from "../services/deployments.service.js";

type IdRequest = Request<{ id: string }>;

export function deploymentsController(db: PrismaClient) {
  const deployments = deploymentsService(db);

  const ownedServiceId = async (req: IdRequest, res: Response) =>
    (await findOwnedService(db, req.params.id, memberOrganizationIds(res))).id;

  return {
    async start(req: IdRequest, res: Response) {
      const serviceId = await ownedServiceId(req, res);
      res
        .status(202)
        .json(await deployments.start(serviceId, sessionUser(res).id, req.get("Idempotency-Key")));
    },

    async rollback(req: IdRequest, res: Response) {
      res
        .status(202)
        .json(
          await deployments.rollback(
            req.params.id,
            memberOrganizationIds(res),
            sessionUser(res).id,
            req.get("Idempotency-Key"),
          ),
        );
    },

    async list(req: IdRequest, res: Response) {
      res.json(await deployments.list(await ownedServiceId(req, res)));
    },

    async metrics(req: IdRequest, res: Response) {
      const serviceId = await ownedServiceId(req, res);
      res.json(await deployments.metrics(serviceId, req.query.minutes));
    },

    async logs(req: IdRequest, res: Response) {
      const serviceId = await ownedServiceId(req, res);
      res.json(await deployments.logs(serviceId, req.query.lines));
    },

    async find(req: IdRequest, res: Response) {
      res.json(await deployments.find(req.params.id, memberOrganizationIds(res)));
    },
  };
}
