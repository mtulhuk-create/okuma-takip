// İmzalı, kısa ömürlü token'lar (HMAC-SHA256).
// - Hızlı bildirim: servis worker'ı / mobil bildirim, oturum çerezi olmadan okuma bildirebilir.
import { b64urlDecode, b64urlEncode, utf8 } from "./b64";

async function key(secret = process.env.APP_SECRET) {
  if (!secret) throw new Error("APP_SECRET tanımlı değil");
  return crypto.subtle.importKey("raw", utf8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signPayload(payload: { e: number } & Record<string, unknown>, secret?: string) {
  const body = b64urlEncode(utf8(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), utf8(body));
  return `${body}.${b64urlEncode(sig)}`;
}

export async function verifyPayload<T extends { e: number }>(token: string, secret?: string, graceMs = 0): Promise<T | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), b64urlDecode(sig), utf8(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as T;
    return Date.now() > p.e + graceMs ? null : p;
  } catch {
    return null; // bozuk token
  }
}

export function signQuickToken(userId: string, groupId: string, dayKey: string, expiresAt: Date) {
  return signPayload({ t: "q", u: userId, g: groupId, d: dayKey, e: expiresAt.getTime() });
}

/** graceMs: çevrimdışı yapılan işlem için süresi yeni dolmuş token kabul edilir (işlem anı ayrıca kontrol edilir) */
export async function verifyQuickToken(token: string, graceMs = 0) {
  const p = await verifyPayload<{ t?: string; u: string; g: string; d: string; e: number }>(token, undefined, graceMs);
  if (!p || (p.t && p.t !== "q")) return null;
  return { userId: p.u, groupId: p.g, dayKey: p.d };
}
