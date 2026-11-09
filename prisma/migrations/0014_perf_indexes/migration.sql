-- Hız: sık çalışan sorgular için indeksler
CREATE INDEX IF NOT EXISTS "ReadingLog_kefaretPlanId_idx" ON "ReadingLog"("kefaretPlanId");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
