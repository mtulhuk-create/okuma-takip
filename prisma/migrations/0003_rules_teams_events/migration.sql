-- AlterTable
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "minDiscount" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS "targetPages" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS "teamsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Veri taşıma: eski üye hedeflerinden grubun günlük hedefini belirle
UPDATE "Group" g SET "targetPages" = GREATEST(g."minPages", COALESCE((SELECT MAX(m."dailyPages") FROM "GroupMember" m WHERE m."groupId" = g."id"), 0));

-- AlterTable
ALTER TABLE "GroupMember" DROP COLUMN "dailyPages",
ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "JoinRequest" ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "ReadingLog" ADD COLUMN     "minPages" INTEGER NOT NULL DEFAULT 0;
UPDATE "ReadingLog" SET "minPages" = "requiredPages";

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "penaltyMode" "PenaltyMode" NOT NULL DEFAULT 'FIXED',
    "targetPages" INTEGER NOT NULL DEFAULT 20,
    "minPages" INTEGER NOT NULL DEFAULT 10,
    "penaltyAmount" INTEGER NOT NULL DEFAULT 20,
    "minDiscount" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamChangeRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupEvent" (
    "id" SERIAL NOT NULL,
    "groupId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Team_groupId_idx" ON "Team"("groupId");

-- CreateIndex
CREATE INDEX "TeamChangeRequest_groupId_status_idx" ON "TeamChangeRequest"("groupId", "status");

-- CreateIndex
CREATE INDEX "GroupEvent_groupId_id_idx" ON "GroupEvent"("groupId", "id");

-- CreateIndex
CREATE INDEX "GroupEvent_createdAt_idx" ON "GroupEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEvent" ADD CONSTRAINT "GroupEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

