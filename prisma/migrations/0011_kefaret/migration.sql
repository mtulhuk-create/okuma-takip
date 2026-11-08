-- Kefaret okuması: cezalara okuma karşılığı indirim
-- CreateEnum
CREATE TYPE "KefaretStatus" AS ENUM ('ACTIVE', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "ReadingLog" ADD COLUMN     "kefaret" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kefaretPlanId" TEXT;

-- CreateTable
CREATE TABLE "KefaretPlan" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "KefaretStatus" NOT NULL DEFAULT 'ACTIVE',
    "discountPercent" INTEGER NOT NULL,
    "raisePercent" INTEGER NOT NULL,
    "penaltyTotal" INTEGER NOT NULL,
    "missedPages" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL,
    "pageValue" DOUBLE PRECISION NOT NULL,
    "pages" INTEGER NOT NULL,
    "dailyExtra" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "doneDays" INTEGER NOT NULL DEFAULT 0,
    "earned" INTEGER NOT NULL DEFAULT 0,
    "startDay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "KefaretPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KefaretPlan_groupId_status_idx" ON "KefaretPlan"("groupId", "status");

-- CreateIndex
CREATE INDEX "KefaretPlan_groupId_userId_idx" ON "KefaretPlan"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "KefaretPlan" ADD CONSTRAINT "KefaretPlan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KefaretPlan" ADD CONSTRAINT "KefaretPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

