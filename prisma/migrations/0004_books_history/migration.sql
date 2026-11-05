-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "books" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "shareProgress" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReadingLog" ADD COLUMN     "books" JSONB;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "books" JSONB NOT NULL DEFAULT '[]';

