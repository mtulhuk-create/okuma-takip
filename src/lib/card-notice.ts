// Gün kartının tepesinde kısa süre beliren mini bilgi (sistem uyarısı yerine): "Hedefe ulaşıldı ✓", "Geri alındı"…
import { useSyncExternalStore } from "react";

type Notice = { text: string; tone: "ok" | "info"; at: number };
const notices = new Map<string, Notice>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Ekranda kalma süresi (sonra yavaşça kaybolur) */
export const NOTICE_MS = 2600;

/** Sunucunun uzun mesajını kartın tepesine sığacak kısa bir bilgiye çevirir */
export function shortNotice(message: string): Notice["text"] {
  if (/geri alındı/i.test(message)) return "Bildirim geri alındı";
  if (/^Harika/i.test(message)) return "Hedefe ulaşıldı ✓";
  if (/^Kefaret/i.test(message)) return "Kefaret okuması kaydedildi ✓";
  if (/İnternet yok/i.test(message)) return "Çevrimdışı kaydedildi · internet gelince gider";
  // "1 sa bildirildi. Hedef 2 sa — …" → "1 sa bildirildi"
  return message.split(/[.—]/)[0].trim().slice(0, 48);
}

export function showCardNotice(groupId: string, message: string) {
  const text = shortNotice(message);
  notices.set(groupId, { text, tone: /geri alındı|Çevrimdışı/i.test(text) ? "info" : "ok", at: Date.now() });
  emit();
  setTimeout(() => {
    const n = notices.get(groupId);
    if (n && Date.now() - n.at >= NOTICE_MS) {
      notices.delete(groupId);
      emit();
    }
  }, NOTICE_MS + 50);
}

/** Bu grubun gün kartında gösterilecek bilgi (yoksa null) */
export function useCardNotice(groupId: string) {
  return useSyncExternalStore(subscribe, () => notices.get(groupId) ?? null);
}
