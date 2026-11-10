import { getDb } from "./db";
import { sendWebPush } from "./webpush";

export type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  renotify?: boolean;
  /** Hızlı bildirim butonları için imzalı token */
  token?: string;
  actions?: { action: string; title: string }[];
};

/**
 * Bildirim: inApp=true ise uygulama içi bildirim kutusuna yazar; push=true ise telefona/tarayıcıya da gönderir.
 * Telefona yalnızca gün kartı, okuma hatırlatmaları ve grup mesajları gider (gereksiz kalabalık olmasın);
 * diğer olaylar (ödeme, davet, rozet vb.) yalnızca uygulamadaki Bildirimler sayfasında görünür.
 */
export async function notifyUsers(userIds: string[], msg: PushMessage, opts: { inApp?: boolean; push?: boolean } = {}) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const db = getDb();
  if (opts.inApp) {
    await db.notification.createMany({
      data: ids.map((userId) => ({ userId, title: msg.title, body: msg.body, url: msg.url ?? null })),
    });
  }
  if (!opts.push) return;
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: ids } } });
  const results = await Promise.allSettled(subs.map((s) => sendWebPush(s, msg)));
  const gone = subs.filter((_, i) => {
    const r = results[i];
    return r.status === "fulfilled" && r.value === "gone";
  });
  if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone.map((g) => g.id) } } });
}

/** Her kullanıcıya kendine özel mesaj (örn. token içeren) gönderir. */
export async function notifyEach(items: { userId: string; msg: PushMessage }[], opts: { inApp?: boolean; push?: boolean } = {}) {
  await Promise.allSettled(items.map((i) => notifyUsers([i.userId], i.msg, opts)));
}

export async function groupAdminIds(groupId: string) {
  const admins = await getDb().groupMember.findMany({
    where: { groupId, role: "ADMIN", status: "ACTIVE" },
    select: { userId: true },
  });
  return admins.map((a) => a.userId);
}
