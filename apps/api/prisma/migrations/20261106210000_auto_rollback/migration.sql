-- AlterEnum
ALTER TYPE "DeploymentTrigger" ADD VALUE 'auto_rollback';

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "failedAfterLive" TEXT,
ADD COLUMN     "watchFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "watchUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Deployment_watchUntil_idx" ON "Deployment"("watchUntil");

