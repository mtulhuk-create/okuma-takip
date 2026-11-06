-- Varsayılan ceza ödeme vadesi: ay sonu + kaydırma (gün)
ALTER TABLE "Group" ADD COLUMN "dueOffsetDays" INTEGER NOT NULL DEFAULT 0;
