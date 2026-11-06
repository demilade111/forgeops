-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('deploy_failed', 'broke_after_live', 'test');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "slackWebhook" TEXT;

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "deploymentId" UUID,
    "kind" "AlertKind" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "slackedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_organizationId_createdAt_idx" ON "Alert"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

