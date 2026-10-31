import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export const projectsRepository = (db: PrismaClient) => ({
  createProject: (organizationId: string, name: string) =>
    db.project.create({ data: { organizationId, name } }),

  listProjects: (organizationId: string) =>
    db.project.findMany({ where: { organizationId }, orderBy: { createdAt: "asc" } }),

  findProject: (id: string, organizationIds: string[]) =>
    db.project.findFirst({
      where: { id, organizationId: { in: organizationIds } },
      include: { services: { orderBy: { createdAt: "asc" } } },
    }),

  createService: (data: Prisma.ServiceUncheckedCreateInput) => db.service.create({ data }),

  findService: (id: string, organizationIds: string[]) =>
    db.service.findFirst({
      where: { id, project: { organizationId: { in: organizationIds } } },
      include: { project: true },
    }),

  updateService: (id: string, data: Prisma.ServiceUncheckedUpdateInput) =>
    db.service.update({ where: { id }, data }),
});
