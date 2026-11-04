// VAPID anahtarlarını ve rastgele gizli anahtarları üretir: node scripts/generate-keys.mjs
const { webcrypto: c } = await import("node:crypto");
const b64url = (b) => Buffer.from(b).toString("base64url");
const kp = await c.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const pub = await c.subtle.exportKey("raw", kp.publicKey);
const jwk = await c.subtle.exportKey("jwk", kp.privateKey);
const rnd = () => b64url(c.getRandomValues(new Uint8Array(32)));
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${b64url(pub)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log(`APP_SECRET=${rnd()}`);
console.log(`CRON_SECRET=${rnd()}`);
