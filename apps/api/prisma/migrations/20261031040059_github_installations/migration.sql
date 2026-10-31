-- CreateTable
CREATE TABLE "GitHubInstallation" (
    "installationId" BIGINT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("installationId")
);

-- CreateIndex
CREATE INDEX "GitHubInstallation_organizationId_idx" ON "GitHubInstallation"("organizationId");

-- AddForeignKey
ALTER TABLE "GitHubInstallation" ADD CONSTRAINT "GitHubInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
