-- Grup görünüm ayarları: seri rozetleri, ekip çerçeveleri, gün kartı ayrıntısı
ALTER TABLE "Group" ADD COLUMN "streaksEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Group" ADD COLUMN "framesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Group" ADD COLUMN "dayDetails" BOOLEAN NOT NULL DEFAULT true;
