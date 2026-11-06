-- Farklı gruplardaki aynı eseri tek görev saymak için kullanıcı bazlı eser bağları
CREATE TABLE "BookLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "linkGroupId" TEXT NOT NULL,
    "linkBookId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookLink_userId_groupId_bookId_linkGroupId_key" ON "BookLink"("userId", "groupId", "bookId", "linkGroupId");
CREATE INDEX "BookLink_userId_groupId_idx" ON "BookLink"("userId", "groupId");

ALTER TABLE "BookLink" ADD CONSTRAINT "BookLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
