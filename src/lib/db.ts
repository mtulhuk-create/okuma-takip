import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Sunucu örneği boyunca tek bir bağlantı havuzu (Vercel Fluid compute örnekleri yeniden kullanır).
const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 5, idleTimeoutMillis: 30_000 });
  return new PrismaClient({ adapter });
}

const prisma = (globalForDb.prisma ??= createClient());


export function getDb() {
  return prisma;
}
