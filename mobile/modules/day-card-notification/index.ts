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

type Native = { show(json: string): void; hide(id: string): void; hideAll(): void };
const native = requireOptionalNativeModule<Native>("DayCardNotification");

export const dayCardNotificationAvailable = !!native;
export function showDayCardNotification(p: DayCardPayload) {
  native?.show(JSON.stringify(p));
}
export function hideDayCardNotification(id: string) {
  native?.hide(id);
}
export function hideAllDayCardNotifications() {
  native?.hideAll();
}
