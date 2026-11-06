-- CreateTable
CREATE TABLE "MetricSample" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" UUID NOT NULL,
    "deploymentId" UUID NOT NULL,
    "cpuPercent" DOUBLE PRECISION NOT NULL,
    "memoryBytes" BIGINT NOT NULL,
    "memoryLimit" BIGINT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricSample_serviceId_takenAt_idx" ON "MetricSample"("serviceId", "takenAt");

-- CreateIndex
CREATE INDEX "MetricSample_takenAt_idx" ON "MetricSample"("takenAt");

-- AddForeignKey
ALTER TABLE "MetricSample" ADD CONSTRAINT "MetricSample_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

