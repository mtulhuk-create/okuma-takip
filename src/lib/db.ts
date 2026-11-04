import { PrismaNeon } from "@prisma/adapter-neon";
import { cache } from "react";
import { PrismaClient } from "@prisma/client";

function createClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

// Cloudflare Workers'ta bağlantılar istekler arasında paylaşılamaz;
// bu yüzden her istek için bir istemci oluşturulur (React cache ile istek içinde tekildir).
export const getDb = cache(createClient);
