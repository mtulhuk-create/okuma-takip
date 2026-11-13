-- Yeni gruplarda ekip çerçeveleri varsayılan kapalı (seri varsayılan açık kalır); mevcut grupların ayarı değişmez
ALTER TABLE "Group" ALTER COLUMN "framesEnabled" SET DEFAULT false;
