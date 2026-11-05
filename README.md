# Okuma Takip

Okuma grubu kur, her gün sayfanı bildir, hedefin altında kalırsan ceza öde.

- **Web / mobil web:** Next.js 16 · Clerk · Prisma 7 + Neon (PostgreSQL) · Vercel — https://okumatakip.vercel.app
- **Android:** React Native (Expo SDK 58) — `mobile/`

## Özellikler
- **Grup sohbeti (WhatsApp benzeri):** mesaj, anket, gerçek zamanlı akış (SSE). Ayarlardan "tüm üyeler" ya da "yalnızca yöneticiler" yazabilir.
- **Gün kartları:** her okuma günü sohbetin ortasına otomatik düşer; *Okudum / Alt sınırı okudum / Okumadım* butonları ve
  okuyan · alt sınır · okumayan · bekleyen listeleri (üst üste profil resimleri, dokununca isimler).
- **Bugün ekranı:** her grubun sade gün kartı (dokununca sohbette o güne gider) ve son 7 gün tablosu.
- **Okuma kuralları:** önce ceza türü (günlük sabit / eksik sayfa başına), sonra günlük hedef, alt sınır, ceza ve
  alt sınırı okuyana % indirim. Canlı "kim ne öder" önizlemesi.
- **Ekipler:** grup ekiplere bölünebilir; her ekibin kendi kuralları olur. Katılan ekibini seçer, ekip değişikliği yönetici onayıyla.
- **Gruplar:** özel (davetle) ya da herkese açık (katılma isteği). Kullanıcı arayıp uygulama içi davet.
- **Cezalar:** yönetici vade verir; üye IBAN'a öder, "Ödedim" der; vadesinde onaylanmazsa otomatik gruptan çıkarılır.
- **Bildirimler:** web push (PWA) ve Android'de cihazda planlanan native bildirimler (uyarı + son 10 dk geri sayım, butonlu).
- Açık / koyu / sistem teması.

## Mimari notları
| Konu | Çözüm |
|---|---|
| Veritabanı | Neon (us-east-1), `@prisma/adapter-pg` havuzu; Vercel fonksiyonları `iad1` bölgesinde (DB'ye ~1 ms) |
| Gerçek zamanlı | `GroupEvent` tablosu + `/api/m/groups/[id]/events` (tarayıcıda SSE, mobilde kısa yoklama) |
| Zamanlanmış işler | `/api/cron`: Vercel günlük cron + GitHub Actions (5 dk) + sayfa açılışında `after()` ile bakım |
| Mobil API | `/api/m/*` — Clerk oturum token'ı (Bearer); değişiklikler web'deki server action'ları çalıştırır |

## Geliştirme
```bash
npm install
cp .env.example .env              # Neon + Clerk değerleri
node scripts/generate-keys.mjs >> .env
npx prisma migrate deploy
npm run dev
node scripts/e2e.mts http://localhost:3000   # uçtan uca test (geçici Clerk kullanıcılarıyla, sonunda siler)
```

## Yayın
Vercel projesi: `okuma-takip` (ortam değişkenleri Vercel'de). Elle dağıtım: `npx vercel deploy --prod`.

## Android APK
```bash
cd mobile && npm install
cp .env.example .env        # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
npx expo prebuild -p android --clean
cd android && ./gradlew assembleRelease     # JDK 21 + Android SDK
```
İmza anahtarı depo dışında: `~/android-build/okuma-takip-keystore.properties` (ya da `KEYSTORE_PROPERTIES`).
