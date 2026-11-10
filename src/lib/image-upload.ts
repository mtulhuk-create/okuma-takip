// Tarayıcıda fotoğrafı küçültüp doğrudan Cloudinary'ye yükler (dosya uygulamanın sunucusuna gelmez).

export type Ticket = { url: string; fields: Record<string, string> };

/** En uzun kenarı 1280 piksele indirir, JPEG olarak sıkıştırır (tipik olarak 150-300 KB) */
export async function compressImage(file: File, max = 1280, quality = 0.72): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // Saydam PNG'ler siyah görünmesin
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("Fotoğraf hazırlanamadı");
  return { blob, w, h };
}

/** İlerleme bildirerek yükler; Cloudinary'nin verdiği kalıcı adresi döndürür */
export function uploadImage(ticket: Ticket, blob: Blob, onProgress?: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(ticket.fields)) fd.append(k, v);
    fd.append("file", blob, "foto.jpg");
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
