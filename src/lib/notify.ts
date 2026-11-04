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

/** Push bildirimi gönderir; inApp=true ise uygulama içi bildirim kutusuna da yazar. */
export async function notifyUsers(userIds: string[], msg: PushMessage, opts: { inApp?: boolean } = {}) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const db = getDb();
  if (opts.inApp) {
    await db.notification.createMany({
      data: ids.map((userId) => ({ userId, title: msg.title, body: msg.body, url: msg.url ?? null })),
    });
  }
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: ids } } });
  const results = await Promise.allSettled(subs.map((s) => sendWebPush(s, msg)));
  const gone = subs.filter((_, i) => {
    const r = results[i];
    return r.status === "fulfilled" && r.value === "gone";
  });
  if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone.map((g) => g.id) } } });
}

/** Her kullanıcıya kendine özel mesaj (örn. token içeren) gönderir. */
export async function notifyEach(items: { userId: string; msg: PushMessage }[], opts: { inApp?: boolean } = {}) {
  await Promise.allSettled(items.map((i) => notifyUsers([i.userId], i.msg, opts)));
}

export async function groupAdminIds(groupId: string) {
  const admins = await getDb().groupMember.findMany({
    where: { groupId, role: "ADMIN", status: "ACTIVE" },
    select: { userId: true },
  });
  return admins.map((a) => a.userId);
}
