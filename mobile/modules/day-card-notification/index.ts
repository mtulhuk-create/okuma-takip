// Kilit ekranında duran özel tasarımlı gün kartı bildirimi (yalnızca Android, tam sürüm).
// Butonlar okumayı JS açılmadan doğrudan sunucuya bildirir.
import { requireOptionalNativeModule } from "expo-modules-core";

/** Kart satırı: eser ve yanındaki küçük butonlar (kefaret · okudum · alt sınır · okumadım) */
export type DayCardBook = { id: string; title: string; target: number; min: number; pages: number | null; kefPages?: number };
export type DayCardPayload = {
  id: string;
  dayKey: string;
  token: string;
  apiUrl: string;
  title: string;
  subtitle: string;
  deadline: number;
  done: number;
  total: number;
  kefCount: number;
  /** Gün çubuğu bölümleri (kişi sayısı) */
  seg: { kef: number; read: number; min: number; none: number; pending: number };
  books: DayCardBook[];
  /** Süren kefaret okuması varsa kefaret butonu görünür */
  plan: boolean;
  /** Bugün kefaret okuması bildirildi */
  kefaretOn: boolean;
  /** Butonların sağ alt çentiğinde yazılan ceza (TL; 0 ise gösterilmez) */
  fineMin: number;
  fineNone: number;
  kefaretLine: string | null;
};

type Native = {
  show(json: string): void;
  schedule?(json: string): void;
  hide(id: string): void;
  hideAll(): void;
  showKaza?(json: string): void;
  hideKaza?(): void;
  getAppIcon?(): string;
  configureInbox?(apiUrl: string, token: string, enabled: boolean): void;
  setInboxAfter?(iso: string): void;
  showMessages?(json: string, skipGroupId: string): void;
  dismissMessages?(groupId: string): void;
  setAppIcon?(name: string): void;
};
const native = requireOptionalNativeModule<Native>("DayCardNotification");

export const dayCardNotificationAvailable = !!native;
export function showDayCardNotification(p: DayCardPayload) {
  native?.show(JSON.stringify(p));
}
/** Sonraki okuma günlerinin kartları: gün başında sistem alarmıyla, uygulama açılmadan gösterilir */
export function scheduleDayCardNotifications(items: (DayCardPayload & { start: number })[]) {
  native?.schedule?.(JSON.stringify(items));
}
/** Aynı plan tekrar gönderilmesin diye dışarıdan JSON metniyle de çağrılabilir */
export function scheduleDayCardNotificationsJson(json: string) {
  native?.schedule?.(json);
}
export function hideDayCardNotification(id: string) {
  native?.hide(id);
}
export function hideAllDayCardNotifications() {
  native?.hideAll();
}

/** Namaz kaza kartı: vakit butonlarına basınca uygulama açılmadan "kaza kılındı" bildirir */
export type KazaPayload = {
  token: string;
  apiUrl: string;
  remaining: Record<string, number>;
  today: number;
  goal: number;
  labels: Record<string, string>;
};
export const kazaNotificationAvailable = !!native?.showKaza;
export function showKazaNotification(p: KazaPayload) {
  native?.showKaza?.(JSON.stringify(p));
}
export function hideKazaNotification() {
  native?.hideKaza?.();
}

/** Uygulama simgesi (Android): açık ya da koyu amblem */
export type AppIcon = "light" | "dark";
export const appIconAvailable = !!native?.setAppIcon;
export function getAppIcon(): AppIcon {
  return native?.getAppIcon?.() === "dark" ? "dark" : "light";
}
export function setAppIcon(name: AppIcon) {
  native?.setAppIcon?.(name);
}

/** Uygulama kapalıyken grup mesajı kontrolü: yerel alarm ~15 dakikada bir sunucuya sorar (JS başlatmaz) */
export function configureInboxPoller(apiUrl: string, token: string, enabled: boolean) {
  try {
    native?.configureInbox?.(apiUrl, token, enabled);
  } catch {}
}
/** Bu andan önceki mesajlar görüldü sayılır (yerel kontrol tekrar bildirmesin) */
export function setInboxPollerAfter(iso: string) {
  try {
    native?.setInboxAfter?.(iso);
  } catch {}
}

/**
 * Grup mesajlarını WhatsApp grubu tarzında bildirir (grup adı + "kişi: mesaj" satırları, yeni mesajlar eklenir).
 * Yerel modül yoksa false döner; çağıran basit bildirime düşer.
 */
export function showInboxMessages(messages: unknown[], skipGroupId: string | null) {
  if (!native?.showMessages) return false;
  try {
    native.showMessages(JSON.stringify(messages), skipGroupId ?? "");
    return true;
  } catch {
    return false;
  }
}
export function dismissInboxMessages(groupId: string) {
  try {
    native?.dismissMessages?.(groupId);
  } catch {}
}
