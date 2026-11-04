# 📚 KitapKurdu — Okuma Takip

Next.js 16 · Clerk · Prisma 7 + Neon · Cloudflare Workers (OpenNext) · Capacitor (Android APK) · PWA

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
| Android APK | Cihazda planlanan yerel bildirimler (internet/Firebase gerekmez). Uygulama her açıldığında plan tazelenir. |

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

## Android APK
```bash
CAP_SERVER_URL=https://kitapkurdu.<subdomain>.workers.dev npx cap sync android
cd android && ./gradlew assembleRelease   # JDK 21 + Android SDK gerekir
```
APK: `android/app/build/outputs/apk/release/app-release.apk`

## Notlar
- Clerk **geliştirme** anahtarları workers.dev alan adında çalışır. Clerk **production** örneği kendi alan adınızı ister.
- APK içinde Google ile giriş WebView kısıtlaması nedeniyle çalışmaz; e-posta ile giriş/kayıt kullanın.
- Saatler Türkiye saatine (UTC+3) göredir.
