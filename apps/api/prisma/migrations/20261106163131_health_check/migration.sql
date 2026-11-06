-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "healthCheckPath" TEXT NOT NULL DEFAULT '/health/ready';
