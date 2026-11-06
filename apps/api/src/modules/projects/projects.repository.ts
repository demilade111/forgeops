import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

type Deletion = { projectId: string } | { serviceId: string };

const deletionMessage = (target: Deletion) => ({
  type: "deletion.requested",
  payload: target,
});

export const projectsRepository = (db: PrismaClient) => ({
  createProject: (organizationId: string, name: string) =>
    db.project.create({ data: { organizationId, name } }),

  listProjects: (organizationId: string) =>
    db.project.findMany({
      where: { organizationId, deletingAt: null },
      orderBy: { createdAt: "asc" },
    }),

  findProject: (id: string, organizationIds: string[]) =>
    db.project.findFirst({
      where: { id, organizationId: { in: organizationIds }, deletingAt: null },
      include: { services: { where: { deletingAt: null }, orderBy: { createdAt: "asc" } } },
    }),

  createService: (data: Prisma.ServiceUncheckedCreateInput) => db.service.create({ data }),

  findService: (id: string, organizationIds: string[]) =>
    db.service.findFirst({
      where: {
        id,
        deletingAt: null,
        project: { organizationId: { in: organizationIds }, deletingAt: null },
      },
      include: { project: true },
    }),

  updateService: (id: string, data: Prisma.ServiceUncheckedUpdateInput) =>
    db.service.update({ where: { id }, data }),

  requestDeletion: (target: Deletion) =>
    db.$transaction(async (tx) => {
      const where =
        "projectId" in target ? { projectId: target.projectId } : { id: target.serviceId };
      const ids = (
        "projectId" in target
          ? await tx.$queryRaw<{ id: string }[]>`
              SELECT id FROM "Service" WHERE "projectId" = ${target.projectId}::uuid ORDER BY id FOR UPDATE`
          : await tx.$queryRaw<{ id: string }[]>`
              SELECT id FROM "Service" WHERE id = ${target.serviceId}::uuid FOR UPDATE`
      ).map((s) => s.id);
      if (await tx.deployment.count({ where: { activeServiceId: { in: ids } } })) return false;
      const deletingAt = new Date();
      await tx.service.updateMany({ where, data: { deletingAt } });
      if ("projectId" in target) {
        await tx.project.update({ where: { id: target.projectId }, data: { deletingAt } });
      }
      await tx.outbox.create({ data: deletionMessage(target) });
      return true;
    }),

  servicesToRemove: (target: Deletion) =>
    db.service.findMany({
      where:
        "projectId" in target
          ? { projectId: target.projectId, project: { deletingAt: { not: null } } }
          : { id: target.serviceId, deletingAt: { not: null } },
      select: { id: true },
    }),

  finishDeletion: (target: Deletion) =>
    "projectId" in target
      ? db.project.deleteMany({ where: { id: target.projectId, deletingAt: { not: null } } })
      : db.service.deleteMany({ where: { id: target.serviceId, deletingAt: { not: null } } }),

  retryDeletions: (requestedBefore: Date) =>
    db.$transaction(async (tx) => {
      const stuck = { deletingAt: { lt: requestedBefore } };
      const projects = await tx.project.findMany({ where: stuck, select: { id: true } });
      const services = await tx.service.findMany({
        where: { ...stuck, project: { deletingAt: null } },
        select: { id: true },
      });
      const targets: Deletion[] = [
        ...projects.map((p) => ({ projectId: p.id })),
        ...services.map((s) => ({ serviceId: s.id })),
      ];
      if (targets.length === 0) return 0;
      const deletingAt = new Date();
      await tx.project.updateMany({
        where: { id: { in: projects.map((p) => p.id) } },
        data: { deletingAt },
      });
      await tx.service.updateMany({
        where: { id: { in: services.map((s) => s.id) } },
        data: { deletingAt },
      });
      await tx.outbox.createMany({ data: targets.map(deletionMessage) });
      return targets.length;
    }),
});
