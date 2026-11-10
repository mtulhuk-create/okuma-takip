// Sohbet fotoğrafı: cihazda küçültülür ve doğrudan Cloudinary'ye yüklenir (dosya uygulamanın sunucusuna gelmez).
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export type Picked = { uri: string; w: number; h: number };
export type Ticket = { url: string; fields: Record<string, string> };

/** Galeriden ya da kameradan tek fotoğraf seçtirir */
export async function pickPhoto(source: "library" | "camera"): Promise<Picked | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: false, exif: false };
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Kamera izni gerekli", "Fotoğraf çekebilmek için ayarlardan kamera iznini aç.");
      return null;
    }
  }
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const a = res.canceled ? null : res.assets?.[0];
  return a ? { uri: a.uri, w: a.width, h: a.height } : null;
}

/** En uzun kenarı 1280 piksele indirir, JPEG olarak sıkıştırır (tipik olarak 150-300 KB) */
export async function compressPhoto(p: Picked, max = 1280): Promise<Picked> {
  const ctx = ImageManipulator.manipulate(p.uri);
  if (Math.max(p.w, p.h) > max) ctx.resize(p.w >= p.h ? { width: max } : { height: max });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
  img.release();
  ctx.release();
  return { uri: out.uri, w: out.width, h: out.height };
}

/** İlerleme bildirerek yükler; Cloudinary'nin verdiği kalıcı adresi döndürür */
export function uploadPhoto(ticket: Ticket, uri: string, onProgress?: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(ticket.fields)) fd.append(k, v);
    fd.append("file", { uri, name: "foto.jpg", type: "image/jpeg" } as unknown as Blob);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", ticket.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const out = JSON.parse(xhr.responseText) as { secure_url?: string; error?: { message?: string } };
        if (xhr.status < 300 && out.secure_url) resolve(out.secure_url);
        else reject(new Error(out.error?.message ?? "Fotoğraf yüklenemedi"));
      } catch {
        reject(new Error("Fotoğraf yüklenemedi"));
      }
    };
    xhr.onerror = () => reject(new Error("Fotoğraf yüklenemedi, bağlantını kontrol et"));
    xhr.send(fd);
  });
}
