// Uygulama sürümü: "full" ya da eski telefonlar için "lite".
// Lite derlemede scripts/build-apk.sh bu dosyayı geçici olarak LITE = true yapar.
// Lite: yönetici özellikleri (grup kurma, grup yönetimi, kefaret başlatma...) yoktur; görsel olarak hafiftir.
export const LITE = false;
export const APP_VARIANT = LITE ? "lite" : "full";
