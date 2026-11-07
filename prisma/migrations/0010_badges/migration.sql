-- Gruba özel latife rozetleri (iyi: Maşallah, kötü: üyelerin oyladığı ad)

-- CreateEnum
CREATE TYPE "BadgeKind" AS ENUM ('GOOD', 'BAD');

-- CreateEnum
CREATE TYPE "BadgeStatus" AS ENUM ('VOTING', 'ACTIVE', 'ENDED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'BADGE';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "badgesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "badgesSince" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "badgeId" TEXT;

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BadgeKind" NOT NULL,
    "status" "BadgeStatus" NOT NULL,
    "label" TEXT,
    "streakDay" TEXT NOT NULL,
    "voteUntil" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "endedDay" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeOption" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeVote" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BadgeVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Badge_groupId_status_idx" ON "Badge"("groupId", "status");

-- CreateIndex
CREATE INDEX "Badge_groupId_userId_idx" ON "Badge"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeOption_badgeId_authorId_key" ON "BadgeOption"("badgeId", "authorId");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeVote_badgeId_userId_key" ON "BadgeVote"("badgeId", "userId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeOption" ADD CONSTRAINT "BadgeOption_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeOption" ADD CONSTRAINT "BadgeOption_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeVote" ADD CONSTRAINT "BadgeVote_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeVote" ADD CONSTRAINT "BadgeVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "BadgeOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeVote" ADD CONSTRAINT "BadgeVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
