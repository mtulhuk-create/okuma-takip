-- Sohbette fotoğraf: dosyanın kendisi Cloudinary'de, burada yalnızca adresi ve boyutu
ALTER TYPE "MessageKind" ADD VALUE 'IMAGE';
ALTER TABLE "Message" ADD COLUMN "media" TEXT,
ADD COLUMN "mediaW" INTEGER,
ADD COLUMN "mediaH" INTEGER;
