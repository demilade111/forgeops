import nodemailer from "nodemailer";
import { z } from "zod";
import type { PrismaClient } from "../../database/prisma-client/client.js";
import { decrypt } from "../../lib/encryption.js";
import { alertsRepository } from "./alerts.repository.js";

export const slackWebhook = /^https:\/\/hooks\.slack\.com\/services\/[\w/-]+$/;

const message = z.object({ type: z.literal("alert.requested"), alertId: z.uuid() });

export type PostJson = (url: string, body: object) => Promise<{ ok: boolean; status: number }>;

const postJson: PostJson = (url, body) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });

export function createAlertSender(
  db: PrismaClient,
  options: { smtpUrl: string | null; appUrl: string; encryptionKey: Buffer; post?: PostJson },
) {
  const repo = alertsRepository(db);
  const mail = options.smtpUrl ? nodemailer.createTransport(options.smtpUrl) : null;
  const post = options.post ?? postJson;

  return async function send(body: unknown) {
    const alert = await repo.forSending(message.parse(body).alertId);
    if (!alert) return;
    const { slackWebhook: webhook, memberships } = alert.organization;
    const link = `${options.appUrl}/app/${alert.deploymentId ? `deployments/${alert.deploymentId}` : "settings"}`;

    if (mail && !alert.emailedAt) {
      await mail.sendMail({
        from: "ForgeOps <alerts@forgeops.localhost>",
        to: memberships.map((m) => m.user.email),
        subject: alert.title,
        text: `${alert.message}\n\nOpen in ForgeOps: ${link}`,
      });
      await repo.markEmailed(alert.id);
    }

    if (webhook && !alert.slackedAt) {
      const url = decrypt(options.encryptionKey, webhook);
      if (!slackWebhook.test(url)) throw new Error("Stored Slack webhook is not a Slack address");
      const res = await post(url, {
        text: `*${alert.title}*\n${alert.message}\n<${link}|Open in ForgeOps>`,
      });
      if (!res.ok) throw new Error(`Slack answered ${res.status}`);
      await repo.markSlacked(alert.id);
    }
  };
}
