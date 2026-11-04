import { defineConfig, env } from "prisma/config";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migration için havuzsuz (direct) bağlantı tercih edilir
  datasource: { url: process.env.DIRECT_URL || env("DATABASE_URL") },
});
