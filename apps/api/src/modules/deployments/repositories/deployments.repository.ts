import type { Prisma, PrismaClient } from "../../../database/prisma-client/client.js";
import { raiseBrokeAfterLive, raiseDeployFailed } from "../../alerts/repositories/alerts.raise.js";

const withSteps = { steps: { orderBy: { startedAt: "asc" } } } as const;

export type RollbackTarget = {
  id: string;
  commitSha: string | null;
  image: string;
  port: number | null;
  healthCheckPath: string | null;
};

export type Outcome = {
  status: "succeeded" | "failed";
  watchUntil?: Date;
  commitSha?: string | null;
  image?: string;
  url?: string;
  error?: string;
  log?: string;
};

export const deploymentsRepository = (db: PrismaClient) => ({
  create: (
    serviceId: string,
    triggeredById: string | null,
    idempotencyKey: string,
    rollbackTo?: RollbackTarget,
    automatic = false,
  ) =>
    db.$transaction(async (tx) => {
      const [service] = await tx.$queryRaw<{ port: number; healthCheckPath: string }[]>`
        SELECT s.port, s."healthCheckPath" FROM "Service" s JOIN "Project" p ON p.id = s."projectId"
        WHERE s.id = ${serviceId}::uuid AND s."deletingAt" IS NULL AND p."deletingAt" IS NULL
        FOR UPDATE OF s`;
      if (!service) return null;
      const deployment = await tx.deployment.create({
        data: {
          serviceId,
          activeServiceId: serviceId,
          trigger: automatic ? "auto_rollback" : rollbackTo ? "rollback" : "manual",
          triggeredById,
          idempotencyKey,
          rollbackOfId: rollbackTo?.id,
          commitSha: rollbackTo?.commitSha,
          image: rollbackTo?.image,
          port: rollbackTo ? (rollbackTo.port ?? service.port) : service.port,
          healthCheckPath: rollbackTo
            ? (rollbackTo.healthCheckPath ?? service.healthCheckPath)
            : service.healthCheckPath,
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
    db.deployment.findMany({
      where: { serviceId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { rollbackOf: { select: { id: true, commitSha: true } } },
    }),

  find: (id: string, organizationIds: string[]) =>
    db.deployment.findFirst({
      where: {
        id,
        service: { deletingAt: null, project: { organizationId: { in: organizationIds } } },
      },
      include: {
        ...withSteps,
        triggeredBy: { select: { email: true } },
        rollbackOf: { select: { id: true, commitSha: true } },
        service: {
          select: {
            id: true,
            name: true,
            branch: true,
            repositoryFullName: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
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

  saveStepLog: (deploymentId: string, name: string, log: string) =>
    db.deploymentStep.updateMany({
      where: { deploymentId, name, status: "running" },
      data: { log },
    }),

  findLive: (serviceId: string) =>
    db.deployment.findFirst({
      where: { serviceId, status: "succeeded" },
      orderBy: { createdAt: "desc" },
    }),

  saveCommit: (id: string, commitSha: string) =>
    db.deployment.update({ where: { id }, data: { commitSha } }),

  completeStep: (deploymentId: string, name: string, log?: string) =>
    db.deploymentStep.update({
      where: { deploymentId_name: { deploymentId, name } },
      data: { status: "succeeded", log, finishedAt: new Date() },
    }),

  finish: (
    id: string,
    step: string,
    { status, commitSha, image, url, error, log, watchUntil }: Outcome,
  ) => {
    const finishedAt = new Date();
    return db.$transaction(async (tx) => {
      await tx.deploymentStep.update({
        where: { deploymentId_name: { deploymentId: id, name: step } },
        data: { status, error, log, finishedAt },
      });
      await tx.deployment.update({
        where: { id },
        data: {
          status,
          commitSha,
          image,
          url,
          error,
          watchUntil,
          finishedAt,
          activeServiceId: null,
        },
      });
      if (status === "failed") await raiseDeployFailed(tx, id, step, error ?? "unknown error");
    });
  },

  watched: () =>
    db.deployment.findMany({
      where: {
        watchUntil: { not: null },
        service: { deletingAt: null, project: { deletingAt: null } },
      },
      include: { service: { select: { port: true, healthCheckPath: true } } },
    }),

  countFailure: (id: string, watchFailures: number) =>
    db.deployment.update({ where: { id }, data: { watchFailures } }),

  stopWatching: (id: string, failedAfterLive?: string, rollbackTo?: string | null) =>
    db.$transaction(async (tx) => {
      await tx.deployment.update({ where: { id }, data: { watchUntil: null, failedAfterLive } });
      if (failedAfterLive) await raiseBrokeAfterLive(tx, id, failedAfterLive, rollbackTo);
    }),

  previousGood: (serviceId: string, before: Date) =>
    db.deployment.findFirst({
      where: {
        serviceId,
        status: "succeeded",
        image: { not: null },
        failedAfterLive: null,
        createdAt: { lt: before },
      },
      orderBy: { createdAt: "desc" },
    }),

  liveAmong: async (ids: string[]) => {
    const found = await db.deployment.findMany({
      where: { id: { in: ids }, status: "succeeded" },
      select: { id: true, serviceId: true, createdAt: true },
    });
    const live = await Promise.all(
      [...new Set(found.map((d) => d.serviceId))].map((serviceId) =>
        db.deployment.findFirst({
          where: { serviceId, status: "succeeded" },
          orderBy: { createdAt: "desc" },
          select: { id: true, serviceId: true },
        }),
      ),
    );
    return live.filter((d) => d && ids.includes(d.id)) as { id: string; serviceId: string }[];
  },

  allLive: () =>
    db.deployment.findMany({
      where: { status: "succeeded" },
      distinct: ["serviceId"],
      orderBy: [{ serviceId: "asc" }, { createdAt: "desc" }],
      select: { id: true, serviceId: true },
    }),

  saveAppLogs: (
    logs: { deploymentId: string; serviceId: string; running: boolean; log: string }[],
  ) =>
    db.$transaction([
      ...logs.map((l) =>
        db.appLog.upsert({ where: { deploymentId: l.deploymentId }, create: l, update: l }),
      ),
      db.appLog.deleteMany({ where: { deploymentId: { notIn: logs.map((l) => l.deploymentId) } } }),
    ]),

  appLog: (deploymentId: string) => db.appLog.findUnique({ where: { deploymentId } }),

  saveSamples: (data: Prisma.MetricSampleCreateManyInput[]) => db.metricSample.createMany({ data }),

  pruneSamples: (before: Date) =>
    db.metricSample.deleteMany({ where: { takenAt: { lt: before } } }),

  samples: (serviceId: string, since: Date) =>
    db.metricSample.findMany({
      where: { serviceId, takenAt: { gte: since } },
      orderBy: { takenAt: "asc" },
      select: { takenAt: true, cpuPercent: true, memoryBytes: true, memoryLimit: true },
    }),

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
