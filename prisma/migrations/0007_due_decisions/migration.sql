-- Vadesi dolan ödemeler: yönetici kararı (ek süre / indirim / çıkarma)
ALTER TYPE "DueStatus" ADD VALUE IF NOT EXISTS 'OVERDUE' BEFORE 'EXPIRED';

ALTER TABLE "Group" ADD COLUMN "kickOnExpire" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PaymentDue" ADD COLUMN "originalDueAt" TIMESTAMP(3),
ADD COLUMN "extensions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "decisionUntil" TIMESTAMP(3);

ALTER TABLE "Penalty" ADD COLUMN "originalAmount" INTEGER;
