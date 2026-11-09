import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { encrypt } from "../../../lib/encryption.js";
import { HttpError, parse } from "../../../lib/http-error.js";
import { alertsRepository } from "../repositories/alerts.repository.js";
import { slackBody } from "../schemas/alerts.schema.js";

export function alertsService(
  db: PrismaClient,
  { encryptionKey, emailEnabled }: { encryptionKey: Buffer | null; emailEnabled: boolean },
) {
  const repo = alertsRepository(db);

  async function overview(organizationId: string) {
    const settings = await repo.settings(organizationId);
    return {
      email: emailEnabled ? settings.memberships.map((m) => m.user.email) : [],
      slackConnected: settings.slackWebhook !== null,
      alerts: await repo.recent(organizationId),
    };
  }

  async function setSlack(organizationId: string, body: unknown) {
    const { url } = parse(slackBody, body);
    if (url && !encryptionKey) {
      throw new HttpError(503, "ENCRYPTION_NOT_CONFIGURED", "Secrets are not set up");
    }
    await repo.setSlack(organizationId, url ? encrypt(encryptionKey!, url) : null);
  }

  return { overview, setSlack, raiseTest: repo.raiseTest };
}
