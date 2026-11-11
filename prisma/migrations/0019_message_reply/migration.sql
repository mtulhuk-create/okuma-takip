-- Mesaj yanıtlama: yanıtlanan mesajın kimliği (o mesaj silinirse boşalır)
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
