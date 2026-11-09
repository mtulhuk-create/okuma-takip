-- Namaz kaza takibi (kişisel, varsayılan kapalı)
CREATE TABLE "Kaza" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "remaining" JSONB NOT NULL DEFAULT '{}',
    "made" JSONB NOT NULL DEFAULT '{}',
    "dailyGoal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Kaza_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "KazaDay" (
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "KazaDay_pkey" PRIMARY KEY ("userId","dayKey")
);

ALTER TABLE "Kaza" ADD CONSTRAINT "Kaza_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KazaDay" ADD CONSTRAINT "KazaDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Kaza"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
