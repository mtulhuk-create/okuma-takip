// Sohbet fotoğrafları: dosyalar uygulamanın sunucusuna hiç gelmez.
// Cihaz fotoğrafı küçültüp doğrudan Cloudinary'ye yükler; sunucu yalnızca yükleme izni verir ve adresi saklar.
// Ayarlar (Vercel ortam değişkenleri):
//   CLOUDINARY_CLOUD_NAME        — hesap adı (zorunlu)
//   CLOUDINARY_UPLOAD_PRESET     — yükleme ön ayarı (imzasız ya da imzalı)
//   CLOUDINARY_API_KEY / _SECRET — varsa yüklemeler imzalanır ve silinen mesajın fotoğrafı da Cloudinary'den silinir
import "server-only";
import { createHash } from "node:crypto";

const env = (k: string) => process.env[k]?.trim() || "";

function config() {
  const cloud = env("CLOUDINARY_CLOUD_NAME");
  const preset = env("CLOUDINARY_UPLOAD_PRESET");
  const apiKey = env("CLOUDINARY_API_KEY");
  const secret = env("CLOUDINARY_API_SECRET");
  if (!/^[\w-]+$/.test(cloud)) return null;
  // İmza yoksa ön ayar şart (imzasız yükleme)
  if (!(apiKey && secret) && !preset) return null;
  return { cloud, preset, apiKey, secret };
}

export const mediaEnabled = () => config() !== null;

const sign = (params: Record<string, string>, secret: string) =>
  createHash("sha1")
    .update(
      Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join("&") + secret,
    )
    .digest("hex");

/** Cihazın Cloudinary'ye doğrudan yükleyeceği adres ve form alanları */
export function uploadTicket(groupId: string) {
  const c = config();
  if (!c) throw new Error("Fotoğraf paylaşımı henüz etkin değil");
  const params: Record<string, string> = { folder: `okuma-takip/${groupId}` };
  if (c.preset) params.upload_preset = c.preset;
  if (c.apiKey && c.secret) {
    params.timestamp = String(Math.floor(Date.now() / 1000));
    params.signature = sign(params, c.secret);
    params.api_key = c.apiKey;
  }
  return { url: `https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`, fields: params };
}

/** Yalnızca bu hesaba yüklenmiş görsel adresleri kabul edilir (başka sitelerden adres verilemez) */
export function checkMediaUrl(url: string) {
  const c = config();
  if (!c) throw new Error("Fotoğraf paylaşımı henüz etkin değil");
  const re = new RegExp(`^https://res\\.cloudinary\\.com/${c.cloud}/image/upload/(v\\d+/)?[\\w/-]+\\.(jpe?g|png|webp)$`);
  if (!re.test(url)) throw new Error("Geçersiz fotoğraf adresi");
  return url;
}

/** Cloudinary dönüşümü: istenen genişliğe kadar küçült, en uygun biçim ve kalite */
export const mediaVariant = (url: string, w: number) => url.replace("/image/upload/", `/image/upload/c_limit,w_${w},q_auto,f_auto/`);

export function mediaView(m: { media: string | null; mediaW: number | null; mediaH: number | null }) {
  if (!m.media) return null;
  return { thumb: mediaVariant(m.media, 640), full: mediaVariant(m.media, 1600), w: m.mediaW ?? 0, h: m.mediaH ?? 0 };
}

/** Silinen mesajın fotoğrafını Cloudinary'den de kaldırır (yalnızca API anahtarı tanımlıysa) */
export async function destroyMedia(url: string) {
  const c = config();
  if (!c?.apiKey || !c.secret) return;
  const id = url.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.\w+$/)?.[1];
  if (!id) return;
  const params: Record<string, string> = { public_id: id, timestamp: String(Math.floor(Date.now() / 1000)) };
  const body = new URLSearchParams({ ...params, api_key: c.apiKey, signature: sign(params, c.secret) });
  await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/destroy`, { method: "POST", body }).catch(() => {});
}
