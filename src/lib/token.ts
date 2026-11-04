// Bildirimlerdeki hızlı butonlar için imzalı, kısa ömürlü token.
// Böylece servis worker'ı veya native bildirim, oturum çerezi olmadan okuma bildirebilir.
import { b64urlDecode, b64urlEncode, utf8 } from "./b64";

type Payload = { u: string; g: string; d: string; e: number };

async function key() {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET tanımlı değil");
  return crypto.subtle.importKey("raw", utf8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signQuickToken(userId: string, groupId: string, dayKey: string, expiresAt: Date) {
  const body = b64urlEncode(utf8(JSON.stringify({ u: userId, g: groupId, d: dayKey, e: expiresAt.getTime() } satisfies Payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(), utf8(body));
  return `${body}.${b64urlEncode(sig)}`;
}

export async function verifyQuickToken(token: string) {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await key(), b64urlDecode(sig), utf8(body));
  if (!ok) return null;
  const p = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Payload;
  if (Date.now() > p.e) return null;
  return { userId: p.u, groupId: p.g, dayKey: p.d };
}
