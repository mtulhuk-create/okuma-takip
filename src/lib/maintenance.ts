import "server-only";
import { after } from "next/server";
import { processDues, settleGroup } from "./cron";
import { getDb } from "./db";

/**
 * Yanıt gönderildikten sonra arka planda: biten günlerin cezalarını yazar ve vadesi geçen ödemeleri işler.
 * Böylece dakikalık cron olmadan da kullanıcı sayfayı açtığında her şey günceldir.
 */
export function maintainLater(groupIds: string[]) {
  if (!groupIds.length) return;
  after(async () => {
    try {
      const groups = await getDb().group.findMany({ where: { id: { in: groupIds } }, include: { teams: true } });
      for (const g of groups) await settleGroup(g);
      await processDues();
    } catch (e) {
      console.error("bakım hatası", e);
    }
  });
}
