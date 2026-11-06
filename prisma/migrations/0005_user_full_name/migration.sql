-- Kullanıcıdan ad soyad alınıp alınmadığı
ALTER TABLE "User" ADD COLUMN "nameConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- Adı zaten iki ya da daha fazla kelimeden oluşanlar ad soyad girmiş sayılır; diğerlerinden bir kez istenir
UPDATE "User" SET "nameConfirmed" = true WHERE position(' ' in btrim("name")) > 0;
