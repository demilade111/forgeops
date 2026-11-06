import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { HttpError, parse } from "../../http-error.js";
import { encrypt } from "../../secrets.js";
import { createRequireAuth, memberOrganizationId } from "../auth/auth.router.js";
import { alertsRepository } from "./alerts.repository.js";
import { slackWebhook } from "./alerts.send.js";

const slackBody = z.object({
  url: z
    .string()
    .trim()
    .regex(
      slackWebhook,
      "Paste a Slack incoming webhook URL (https://hooks.slack.com/services/...)",
    )
    .nullable(),
});

export function createAlertsRouter(
  db: PrismaClient,
  { encryptionKey, emailEnabled }: { encryptionKey: Buffer | null; emailEnabled: boolean },
) {
  const repo = alertsRepository(db);
  const router = Router();
  router.use("/organizations/:id/alerts", createRequireAuth(db));

  router.get("/organizations/:id/alerts", async (req, res) => {
    const organizationId = memberOrganizationId(res, req.params.id);
    const settings = await repo.settings(organizationId);
    res.json({
      email: emailEnabled ? settings.memberships.map((m) => m.user.email) : [],
      slackConnected: settings.slackWebhook !== null,
      alerts: await repo.recent(organizationId),
    });
  });

  router.put("/organizations/:id/alerts/slack", async (req, res) => {
    const organizationId = memberOrganizationId(res, req.params.id);
    const { url } = parse(slackBody, req.body);
    if (url && !encryptionKey) {
      throw new HttpError(503, "ENCRYPTION_NOT_CONFIGURED", "Secrets are not set up");
    }
    await repo.setSlack(organizationId, url ? encrypt(encryptionKey!, url) : null);
    res.status(204).end();
  });

  router.post("/organizations/:id/alerts/test", async (req, res) => {
    res.status(202).json(await repo.raiseTest(memberOrganizationId(res, req.params.id)));
  });

  return router;
}
