-- Sohbet okundu bilgisi: üyenin sohbeti en son okuduğu an (okundu tikleri ve okunmamış mesaj sayısı)
ALTER TABLE "GroupMember" ADD COLUMN "lastReadAt" TIMESTAMP(3);
-- Mevcut üyeler için bugüne kadarki mesajlar okunmuş sayılır (herkese yüzlerce okunmamış görünmesin)
UPDATE "GroupMember" SET "lastReadAt" = CURRENT_TIMESTAMP WHERE "status" = 'ACTIVE';
