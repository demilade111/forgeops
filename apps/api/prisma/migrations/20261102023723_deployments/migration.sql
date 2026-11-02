-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "DeploymentTrigger" AS ENUM ('manual');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "Deployment" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "activeServiceId" UUID,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'queued',
    "trigger" "DeploymentTrigger" NOT NULL,
    "triggeredById" UUID,
    "idempotencyKey" TEXT NOT NULL,
    "commitSha" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentStep" (
    "id" UUID NOT NULL,
    "deploymentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'running',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DeploymentStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" BIGSERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_activeServiceId_key" ON "Deployment"("activeServiceId");

-- CreateIndex
CREATE INDEX "Deployment_serviceId_createdAt_idx" ON "Deployment"("serviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_serviceId_idempotencyKey_key" ON "Deployment"("serviceId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentStep_deploymentId_name_key" ON "DeploymentStep"("deploymentId", "name");

-- CreateIndex
CREATE INDEX "Outbox_sentAt_idx" ON "Outbox"("sentAt");

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentStep" ADD CONSTRAINT "DeploymentStep_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
