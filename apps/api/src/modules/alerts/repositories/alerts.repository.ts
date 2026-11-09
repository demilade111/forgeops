import type { PrismaClient } from "../../../database/prisma-client/client.js";
import { raise } from "./alerts.raise.js";

export const alertsRepository = (db: PrismaClient) => ({
  raiseTest: (organizationId: string) =>
    db.$transaction((tx) =>
      raise(tx, {
        organizationId,
        kind: "test",
        title: "Test alert from ForgeOps",
        message: "Alerts from ForgeOps reach this channel.",
      }),
    ),

  recent: (organizationId: string) =>
    db.alert.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 20 }),

  settings: (organizationId: string) =>
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        slackWebhook: true,
        memberships: { select: { user: { select: { email: true } } } },
      },
    }),

  setSlack: (organizationId: string, slackWebhook: string | null) =>
    db.organization.update({ where: { id: organizationId }, data: { slackWebhook } }),

  forSending: (id: string) =>
    db.alert.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            slackWebhook: true,
            memberships: { select: { user: { select: { email: true } } } },
          },
        },
      },
    }),

  markEmailed: (id: string) => db.alert.update({ where: { id }, data: { emailedAt: new Date() } }),

  markSlacked: (id: string) => db.alert.update({ where: { id }, data: { slackedAt: new Date() } }),
});
