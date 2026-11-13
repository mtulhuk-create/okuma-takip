-- Site yöneticisi: üye olmadığı grupların sohbetini salt okunur görebilir
ALTER TABLE "User" ADD COLUMN "siteAdmin" BOOLEAN NOT NULL DEFAULT false;
-- İlk site yöneticisi
UPDATE "User" SET "siteAdmin" = true WHERE "id" = 'user_3LgbX3y5dO8rWmWtD4pS83GAyos';
