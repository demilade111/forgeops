-- AlterEnum
ALTER TYPE "DeploymentTrigger" ADD VALUE 'rollback';

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "healthCheckPath" TEXT,
ADD COLUMN     "port" INTEGER,
ADD COLUMN     "rollbackOfId" UUID;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_rollbackOfId_fkey" FOREIGN KEY ("rollbackOfId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
