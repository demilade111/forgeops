-- AlterTable
ALTER TABLE "GitHubInstallation" DROP CONSTRAINT "GitHubInstallation_pkey",
ADD CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("installationId", "organizationId");

