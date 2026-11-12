// Mobil uygulamaya anlık bildirim (Firebase Cloud Messaging, HTTP v1).
// Yalnızca veri mesajı gönderilir; bildirimi telefondaki uygulama kendi tasarımıyla gösterir
// (grup mesajı, sabit gün kartının güncellenmesi, hatırlatmaların iptali).
// Ayar (Vercel ortam değişkeni): FIREBASE_SERVICE_ACCOUNT = hizmet hesabı anahtarının JSON içeriği.
// Tanımlı değilse hiçbir şey gönderilmez; uygulama aralıklı kontrolle çalışmaya devam eder.
import "server-only";
import { createSign } from "node:crypto";
import { after } from "next/server";
import { getDb } from "./db";

type Account = { project_id: string; client_email: string; private_key: string };

let cached: Account | null | undefined;
function account(): Account | null {
  if (cached !== undefined) return cached;
  try {
    const a = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? "") as Partial<Account>;
    cached = a.project_id && a.client_email && a.private_key ? { project_id: a.project_id, client_email: a.client_email, private_key: a.private_key.replace(/\\n/g, "\n") } : null;
  } catch {
    cached = null;
  }
  return cached;
}

export const fcmEnabled = () => account() !== null;

const b64 = (v: string | Buffer) => Buffer.from(v).toString("base64url");

// Erişim anahtarı ~1 saat geçerli: sunucu örneğinde saklanır
let token: { value: string; until: number } | null = null;
async function accessToken(a: Account) {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64(JSON.stringify({ iss: a.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(a.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64(sig)}` }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !body.access_token) throw new Error(`Firebase erişim anahtarı alınamadı (${res.status})`);
  token = { value: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

/**
 * Kullanıcıların cihazlarına veri mesajı gönderir (yüksek öncelik: uygulama kapalıyken de hemen ulaşır).
 * Geçersiz olmuş cihaz kayıtları silinir. Hata fırlatmaz.
 */
export async function pushData(userIds: string[], data: Record<string, string>, ttlSeconds = 3600) {
  const a = account();
  const ids = [...new Set(userIds)];
  if (!a || !ids.length) return 0;
  try {
    const db = getDb();
    const devices = await db.pushDevice.findMany({ where: { userId: { in: ids } }, select: { id: true, token: true } });
    if (!devices.length) return 0;
    const auth = await accessToken(a);
    const results = await Promise.allSettled(
      devices.map(async (d) => {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
          method: "POST",
          headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
          body: JSON.stringify({ message: { token: d.token, data, android: { priority: "HIGH", ttl: `${ttlSeconds}s` } } }),
        });
        if (res.ok) return "ok";
        const err = (await res.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } };
        const code = err.error?.details?.find((x) => x.errorCode)?.errorCode ?? err.error?.status;
        // Uygulama silinmiş ya da kayıt yenilenmiş: bu cihaz kaydı artık geçersiz
        return res.status === 404 || code === "UNREGISTERED" ? "gone" : "fail";
      }),
    );
    const gone = devices.filter((_, i) => {
      const r = results[i];
      return r.status === "fulfilled" && r.value === "gone";
    });
    if (gone.length) await db.pushDevice.deleteMany({ where: { id: { in: gone.map((g) => g.id) } } });
    return results.filter((r) => r.status === "fulfilled" && r.value === "ok").length;
  } catch (e) {
    console.error("anlık bildirim", e);
    return 0;
  }
}

/** Yanıtı bekletmeden gönderir (istek bittikten sonra, arka planda) */
export function pushLater(userIds: string[], data: Record<string, string>) {
  if (!fcmEnabled()) return;
  try {
    after(() => pushData(userIds, data));
  } catch {
    // İstek dışında çağrıldıysa (test, cron)
    void pushData(userIds, data);
  }
}
