# 📚 Okuma Takip

Web: Next.js 16 · Clerk · Prisma 7 + Neon · Cloudflare Workers (OpenNext) · PWA
Mobil: React Native (Expo SDK 58) · Clerk Expo · expo-notifications — `mobile/` klasöründe

## Özellikler
- Her üye gruptaki **günlük sayfa hedefini** belirler (grubun alt sınırından az olamaz). Hedefin altında kalınan her gün için **TL cezası** yazılır (gün başına sabit ya da eksik sayfa başına).
- **Özel** gruplar: yönetici kullanıcıları isimle arayıp uygulama içinden davet eder.
  **Herkese açık** gruplar: Gruplar sayfasında listelenir, kullanıcı katılma isteği gönderir; davet de yapılabilir.
- Yönetici; **yeni okuma gününün başlangıç saatini**, **son bildirim saatini** ve **kaç saat önce uyarı** gönderileceğini belirler.
- Uyarı bildiriminde hızlı butonlar: **📖 Okudum (sayı gir)**, **✅ Alt sınırı okudum**, **❌ Okumadım**.
- Son saatten **10 dakika önce dakika dakika geri sayım** bildirimi.
- Yönetici, cezası biriken üyeye **ödeme vadesi** verir. Üye grubun IBAN'ına öder ve "Ödedim" der; vade bitene kadar yönetici onaylamazsa üye **otomatik gruptan atılır**.

## Bildirimler nasıl çalışır?
| Platform | Yöntem |
|---|---|
| Web / mobil web (PWA) | Web Push (VAPID). Sunucudaki dakikalık Cloudflare Cron gönderir. iPhone'da önce "Ana Ekrana Ekle" gerekir. |
| Android (React Native) | Cihazda planlanan native bildirimler (Firebase gerekmez). Butonlar uygulama kapalıyken de çalışır. Plan her açılışta ve her bildirimden sonra tazelenir. |

## Kurulum
```bash
npm install
cp .env.example .env          # değerleri doldurun
node scripts/generate-keys.mjs >> .env   # VAPID + gizli anahtarlar
npx prisma migrate deploy     # tabloları Neon'da oluşturur
npm run dev
```

## Cloudflare'e ücretsiz yayın
> Next.js'in Cloudflare'deki güncel/önerilen yolu OpenNext ile **Cloudflare Workers**'tır (Pages'in Next.js adaptörü kullanımdan kalktı). Free plan yeterlidir; paket ~2.5 MB (sınır 3 MB).

```bash
npx wrangler login
# Gizli değişkenler (çalışma zamanı)
for k in DATABASE_URL CLERK_SECRET_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT APP_SECRET CRON_SECRET APP_URL; do
  grep "^$k=" .env | cut -d= -f2- | tr -d '"' | npx wrangler secret put $k
done
npm run deploy   # NEXT_PUBLIC_* değerleri build sırasında .env'den okunur
```

## Mobil uygulama (React Native / Expo)
```bash
cd mobile
npm install
cp .env.example .env        # EXPO_PUBLIC_API_URL ve EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
npx expo prebuild -p android --clean
cd android && ./gradlew assembleRelease   # JDK 21 + Android SDK
```
APK: `mobile/android/app/build/outputs/apk/release/app-release.apk`

Mobil uygulama sunucuyla `/api/m/*` JSON uç noktaları üzerinden konuşur (Clerk oturum token'ı ile); değişiklikler web'deki server action'ların aynısını çalıştırır.

## Notlar
- Clerk **geliştirme** anahtarları workers.dev alan adında çalışır. Clerk **production** örneği kendi alan adınızı ister.
- Mobil giriş Clerk'in hazır ekranıyla (Account Portal) yapılır; e-posta ve Google desteklenir.
- Saatler Türkiye saatine (UTC+3) göredir.
