import type { PrismaClient } from "../../generated/prisma/client.js";

const withSteps = { steps: { orderBy: { startedAt: "asc" } } } as const;

export type Outcome = {
  status: "succeeded" | "failed";
  commitSha?: string | null;
  image?: string;
  url?: string;
  error?: string;
  log?: string;
};

export const deploymentsRepository = (db: PrismaClient) => ({
  create: (serviceId: string, triggeredById: string, idempotencyKey: string) =>
    db.$transaction(async (tx) => {
      const deployment = await tx.deployment.create({
        data: {
          serviceId,
          activeServiceId: serviceId,
          trigger: "manual",
          triggeredById,
          idempotencyKey,
        },
        include: withSteps,
      });
      await tx.outbox.create({
        data: { type: "deployment.requested", payload: { deploymentId: deployment.id } },
      });
      return deployment;
    }),

  findByKey: (serviceId: string, idempotencyKey: string) =>
    db.deployment.findUnique({
      where: { serviceId_idempotencyKey: { serviceId, idempotencyKey } },
      include: withSteps,
    }),

  findActive: (serviceId: string) =>
    db.deployment.findUnique({ where: { activeServiceId: serviceId } }),

  list: (serviceId: string) =>
    db.deployment.findMany({ where: { serviceId }, orderBy: { createdAt: "desc" }, take: 50 }),

  find: (id: string, organizationIds: string[]) =>
    db.deployment.findFirst({
      where: { id, service: { project: { organizationId: { in: organizationIds } } } },
      include: withSteps,
    }),

  claim: async (id: string) => {
    const { count } = await db.deployment.updateMany({
      where: { id, status: { in: ["queued", "running"] } },
      data: { status: "running", startedAt: new Date() },
    });
    return count === 1;
  },

  findWithService: (id: string) =>
    db.deployment.findUniqueOrThrow({
      where: { id },
      include: { service: { include: { project: true } } },
    }),

  startStep: (deploymentId: string, name: string) =>
    db.deploymentStep.upsert({
      where: { deploymentId_name: { deploymentId, name } },
      create: { deploymentId, name },
      update: {
        status: "running",
        error: null,
        log: null,
        startedAt: new Date(),
        finishedAt: null,
      },
    }),

  saveCommit: (id: string, commitSha: string) =>
    db.deployment.update({ where: { id }, data: { commitSha } }),

  completeStep: (deploymentId: string, name: string, log?: string) =>
    db.deploymentStep.update({
      where: { deploymentId_name: { deploymentId, name } },
      data: { status: "succeeded", log, finishedAt: new Date() },
    }),

  finish: (id: string, step: string, { status, commitSha, image, url, error, log }: Outcome) => {
    const finishedAt = new Date();
    return db.$transaction([
      db.deploymentStep.update({
        where: { deploymentId_name: { deploymentId: id, name: step } },
        data: { status, error, log, finishedAt },
      }),
      db.deployment.update({
        where: { id },
        data: { status, commitSha, image, url, error, finishedAt, activeServiceId: null },
      }),
    ]);
  },

  failStale: async (startedBefore: Date) => {
    const where = { status: "running" as const, startedAt: { lt: startedBefore } };
    const error = "Deployment timed out. Try deploying again.";
    const finishedAt = new Date();
    const [, { count }] = await db.$transaction([
      db.deploymentStep.updateMany({
        where: { status: "running", deployment: where },
        data: { status: "failed", error, finishedAt },
      }),
      db.deployment.updateMany({
        where,
        data: { status: "failed", error, finishedAt, activeServiceId: null },
      }),
    ]);
    return count;
  },

  relayOutbox: (publish: (message: object) => Promise<void>) =>
    db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: bigint; type: string; payload: object }[]>`
        SELECT id, type, payload FROM "Outbox"
        WHERE "sentAt" IS NULL ORDER BY id LIMIT 50
        FOR UPDATE SKIP LOCKED`;
      for (const { type, payload } of rows) await publish({ type, ...payload });
      if (rows.length > 0) {
        await tx.outbox.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { sentAt: new Date() },
        });
      }
      return rows.length;
    }),
});
