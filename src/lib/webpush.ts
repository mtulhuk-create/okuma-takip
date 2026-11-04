// Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) — yalnızca WebCrypto kullanır,
// bu yüzden Cloudflare Workers'ta ek kütüphane olmadan çalışır.
import { b64urlDecode, b64urlEncode, concat, utf8 } from "./b64";

type Bytes = Uint8Array<ArrayBuffer>;

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

async function vapidAuthHeader(endpoint: string) {
  const pub = b64urlDecode(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    d: process.env.VAPID_PRIVATE_KEY!,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64urlEncode(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    utf8(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(unsigned));
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}`;
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bytes * 8));
}

async function encrypt(target: PushTarget, payload: Bytes) {
  const uaPublic = b64urlDecode(target.p256dh);
  const authSecret = b64urlDecode(target.auth);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdh, concat(utf8("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(payload, new Uint8Array([2]))),
  );
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

/** Bildirimi gönderir. Abonelik geçersizse "gone" döner. */
export async function sendWebPush(target: PushTarget, data: unknown, ttlSeconds = 3600) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "skipped" as const;
  const body = await encrypt(target, utf8(JSON.stringify(data)));
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthHeader(target.endpoint),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
      Urgency: "high",
    },
    body,
  });
  if (res.status === 404 || res.status === 410) return "gone" as const;
  return res.ok ? ("ok" as const) : ("error" as const);
}
