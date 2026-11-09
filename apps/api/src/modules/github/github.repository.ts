import type { PrismaClient } from "../../database/prisma-client/client.js";

export const githubRepository = (db: PrismaClient) => ({
  link: (installationId: number, accountLogin: string, organizationId: string) =>
    db.gitHubInstallation.upsert({
      where: {
        installationId_organizationId: { installationId: BigInt(installationId), organizationId },
      },
      create: { installationId: BigInt(installationId), accountLogin, organizationId },
      update: { accountLogin },
    }),

  findForOrganization: (organizationId: string) =>
    db.gitHubInstallation.findFirst({ where: { organizationId }, orderBy: { createdAt: "asc" } }),
});
