// Gruplara yazılan mesajların bildirimi: uygulama açıkken burada kısa aralıklarla, kapalıyken yerel Android
// alarmı (~15 dk, JS başlatmadan) sunucuya sorar; yeni mesajlar grup başına tek bildirim olarak gösterilir.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "./config";
import { configureInboxPoller, setInboxPollerAfter } from "../../modules/day-card-notification";

const TOKEN_KEY = "inbox-token";
const AFTER_KEY = "inbox-after";
const PREF_KEY = "msg-notify";

/** Grup mesajı bildirimleri (varsayılan açık) */
export async function getMessagePref() {
  return (await SecureStore.getItemAsync(PREF_KEY).catch(() => null)) !== "0";
}
export async function setMessagePref(on: boolean) {
  await SecureStore.setItemAsync(PREF_KEY, on ? "1" : "0").catch(() => {});
  await syncPoller();
}

/** Uygulama kapalıyken çalışan yerel kontrolü güncel token ve tercihle kurar */
async function syncPoller() {
  const token = (await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)) ?? "";
  configureInboxPoller(API_URL, token, !!token && (await getMessagePref()));
}

/** Şu an ekranda açık olan sohbet: onun mesajları zaten görülüyor, bildirilmez */
let openChat: string | null = null;
export function setOpenChat(groupId: string | null) {
  openChat = groupId;
  if (groupId) Notifications.dismissNotificationAsync(`msg-${groupId}`).catch(() => {});
}

type InboxMessage = { id: string; groupId: string; groupName: string; author: string; text: string; createdAt: string };

/** Giriş yapılınca alınır; arka plan görevi oturum olmadan bununla okur */
export async function refreshInboxToken(fetcher: <T>(path: string) => Promise<T>) {
  const res = await fetcher<{ token: string }>("/api/m/inbox-token").catch(() => null);
  if (res?.token) await SecureStore.setItemAsync(TOKEN_KEY, res.token).catch(() => {});
  await syncPoller();
}

export async function clearInbox() {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  await AsyncStorage.removeItem(AFTER_KEY).catch(() => {});
  configureInboxPoller(API_URL, "", false);
}

/** Uygulama açıkken mesajlar zaten görülüyor: bu andan sonrası bildirilsin */
export async function markInboxSeen() {
  const now = new Date().toISOString();
  await AsyncStorage.setItem(AFTER_KEY, now).catch(() => {});
  setInboxPollerAfter(now);
}

let checking = false;
export async function checkInbox() {
  if (checking) return 0;
  checking = true;
  try {
    return await checkOnce();
  } finally {
    checking = false;
  }
}

async function checkOnce() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token || !(await getMessagePref())) return 0;
  const after = (await AsyncStorage.getItem(AFTER_KEY).catch(() => null)) ?? new Date().toISOString();
  const res = await fetch(`${API_URL}/api/inbox?after=${encodeURIComponent(after)}`, { headers: { authorization: `Inbox ${token}` } }).catch(() => null);
  if (!res?.ok) return 0;
  const body = (await res.json().catch(() => null)) as { now: string; messages: InboxMessage[] } | null;
  if (!body) return 0;
  await AsyncStorage.setItem(AFTER_KEY, body.now).catch(() => {});
  setInboxPollerAfter(body.now);
  const byGroup = new Map<string, InboxMessage[]>();
  for (const m of body.messages) byGroup.set(m.groupId, [...(byGroup.get(m.groupId) ?? []), m]);
  for (const [groupId, list] of byGroup) {
    if (groupId === openChat) continue;
    const last = list.slice(-3);
    await Notifications.scheduleNotificationAsync({
      identifier: `msg-${groupId}`,
      content: {
        title: `💬 ${list[0].groupName}${list.length > 1 ? ` · ${list.length} yeni mesaj` : ""}`,
        body: last.map((m) => `${m.author}: ${m.text}`).join("\n"),
        data: { groupId, kind: "message" },
      },
      trigger: Platform.OS === "android" ? { channelId: "messages" } : null,
    }).catch(() => {});
  }
  return body.messages.length;
}
