// Kilit ekranında duran özel tasarımlı gün kartı bildirimi (yalnızca Android, tam sürüm).
// Butonlar okumayı JS açılmadan doğrudan sunucuya bildirir.
import { requireOptionalNativeModule } from "expo-modules-core";

export type DayCardButton = { key: "kefaret" | "all" | "min" | "none"; label: string; top?: string; bottom?: string };
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
  myState: "kefaret" | "all" | "min" | "none" | null;
  buttons: DayCardButton[];
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
