-- Kaza geçmişi: o gün kaçırılıp kazaya eklenen namaz (günlük net = kılınan − eklenen)
ALTER TABLE "KazaDay" ADD COLUMN "added" INTEGER NOT NULL DEFAULT 0;
