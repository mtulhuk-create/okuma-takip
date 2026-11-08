-- Mobil uygulamanın Lite sürümünü kullananlar (yönetici yapılamaz)
ALTER TABLE "User" ADD COLUMN "liteApp" BOOLEAN NOT NULL DEFAULT false;
