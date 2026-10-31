import type { PrismaClient } from "../../generated/prisma/client.js";

export const githubRepository = (db: PrismaClient) => ({
  find: (installationId: number) =>
    db.gitHubInstallation.findUnique({ where: { installationId: BigInt(installationId) } }),

  link: (installationId: number, accountLogin: string, organizationId: string) =>
    db.gitHubInstallation.create({
      data: { installationId: BigInt(installationId), accountLogin, organizationId },
    }),

  findForOrganization: (organizationId: string) =>
    db.gitHubInstallation.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" } }),
});
