-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deletingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "deletingAt" TIMESTAMP(3);
