import "server-only";
import type { Group, Team } from "@prisma/client";
import { after } from "next/server";
import { processDues, settleGroup } from "./cron";
import { getDb } from "./db";

// Aynı sunucu örneğinde sık istekte bakım tekrar tekrar çalışmasın (her istek DB'ye ek sorgu ve yazma demekti).
// Gün kapanışı en geç bu kadar gecikir; günlük cron ayrıca hepsini işler.
const GAP_MS = 60_000;
const lastSettle = new Map<string, number>();
let lastDues = 0;

/**
 * Yanıt gönderildikten sonra arka planda: biten günlerin cezalarını yazar ve vadesi geçen ödemeleri işler.
 * Böylece dakikalık cron olmadan da kullanıcı sayfayı açtığında her şey günceldir.
 * groups: zaten yüklenmiş gruplar verilirse yeniden sorgulanmaz.
 */
export function maintainLater(groupIds: string[], groups?: (Group & { teams: Team[] })[]) {
  const now = Date.now();
  const due = groupIds.filter((id) => now - (lastSettle.get(id) ?? 0) >= GAP_MS);
  const dues = now - lastDues >= GAP_MS;
  if (!due.length && !dues) return;
  for (const id of due) lastSettle.set(id, now);
  if (dues) lastDues = now;
  after(async () => {
    try {
      if (due.length) {
        const known = new Map((groups ?? []).map((g) => [g.id, g]));
        const missing = due.filter((id) => !known.has(id));
        const loaded = missing.length ? await getDb().group.findMany({ where: { id: { in: missing } }, include: { teams: true } }) : [];
        for (const g of [...due.map((id) => known.get(id)).filter((g) => !!g), ...loaded]) await settleGroup(g);
      }
      if (dues) await processDues();
    } catch (e) {
      console.error("bakım hatası", e);
    }
  });
}
