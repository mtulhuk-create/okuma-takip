-- Saat hesabıyla okuma: grup ve ekip okuma hesabı (sayfa / dakika); günlük kayıtta o günün hesabı
CREATE TYPE "ReadUnit" AS ENUM ('PAGES', 'MINUTES');
ALTER TABLE "Group" ADD COLUMN "readUnit" "ReadUnit" NOT NULL DEFAULT 'PAGES';
ALTER TABLE "Team" ADD COLUMN "readUnit" "ReadUnit" NOT NULL DEFAULT 'PAGES';
ALTER TABLE "ReadingLog" ADD COLUMN "unit" "ReadUnit" NOT NULL DEFAULT 'PAGES';
