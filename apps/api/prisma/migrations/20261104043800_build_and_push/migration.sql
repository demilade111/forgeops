-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "DeploymentStep" ADD COLUMN     "log" TEXT;
