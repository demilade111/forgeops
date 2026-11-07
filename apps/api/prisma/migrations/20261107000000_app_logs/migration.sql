-- CreateTable
CREATE TABLE "AppLog" (
    "deploymentId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "running" BOOLEAN NOT NULL,
    "log" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppLog_pkey" PRIMARY KEY ("deploymentId")
);

-- CreateIndex
CREATE INDEX "AppLog_serviceId_idx" ON "AppLog"("serviceId");

-- AddForeignKey
ALTER TABLE "AppLog" ADD CONSTRAINT "AppLog_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

