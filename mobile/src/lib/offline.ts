// İnternetsiz kullanım: gün kartında yapılan işlemler cihazda sıraya alınır, internet gelince
// işlemin yapıldığı an (at) ile gönderilir. Sunucu, işlem o günün süresi içinde yapıldıysa
// gün kapanmış olsa da kabul eder.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

export type QueuedReport = {
  id: string;
  /** action: oturumla /api/m/action/reportReading · quick: bildirim butonu (/api/quick-report, token) */
  kind: "action" | "quick";
  groupId: string;
  dayKey: string;
  at: string;
  label: string;
  body: Record<string, unknown>;
};

const KEY = "offline-queue-v1";
let items: QueuedReport[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function save() {
  await AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
  emit();
}

export async function loadQueue() {
  if (loaded) return items;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    items = raw ? (JSON.parse(raw) as QueuedReport[]) : [];
  } catch {
    items = [];
  }
  emit();
  return items;
}

export async function enqueue(item: Omit<QueuedReport, "id" | "at"> & { at?: string }) {
  await loadQueue();
  items = [...items, { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: item.at ?? new Date().toISOString() }];
  await save();
}

export async function removeQueued(id: string) {
  items = items.filter((i) => i.id !== id);
  await save();
}

export function queuedItems() {
  return items;
}

/** Bekleyen işlemler (ekranlarda "çevrimdışı kaydedildi" göstermek için) */
export function useOfflineQueue() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
}

/** Ağ hatası mı (sunucudan yanıt gelmedi)? */
export function isNetworkError(e: unknown) {
  const msg = String((e as Error)?.message ?? e);
  return e instanceof TypeError || /network request failed|network error|failed to fetch|timed? ?out/i.test(msg);
}

let flushing = false;
/**
 * Sıradaki işlemleri sırayla gönderir. send: "ok" (gönderildi), "drop" (sunucu reddetti, at), "retry" (internet yok, dur).
 */
export async function flushQueue(send: (item: QueuedReport) => Promise<"ok" | "drop" | "retry">) {
  if (flushing) return { sent: 0, dropped: [] as { item: QueuedReport; reason: string }[] };
  flushing = true;
  let sent = 0;
  const dropped: { item: QueuedReport; reason: string }[] = [];
  try {
    await loadQueue();
    for (const item of [...items]) {
      const r = await send(item).catch(() => "retry" as const);
      if (r === "retry") break;
      if (r === "ok") sent++;
      else dropped.push({ item, reason: "" });
      await removeQueued(item.id);
    }
  } finally {
    flushing = false;
  }
  return { sent, dropped };
}
