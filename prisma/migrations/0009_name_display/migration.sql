-- Hesaptan gelen ad ve grupta adların nasıl görüneceği
CREATE TYPE "NameDisplay" AS ENUM ('ENTERED', 'ACCOUNT', 'BOTH');

ALTER TABLE "User" ADD COLUMN "accountName" TEXT;
UPDATE "User" SET "accountName" = "name" WHERE "accountName" IS NULL;

ALTER TABLE "Group" ADD COLUMN "nameDisplay" "NameDisplay" NOT NULL DEFAULT 'ENTERED';
