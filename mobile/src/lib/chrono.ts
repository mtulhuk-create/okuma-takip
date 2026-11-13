// Kronometre sabit bildirimi: saat hesabıyla okuyanlar için, ayardan açılır (varsayılan kapalı).
// Okuma bildirimine bağlı değildir; yalnızca süre ölçmeye yarar. Sayacı yerel Android bildirimi tutar.
import * as SecureStore from "expo-secure-store";
import { setChronoNotification } from "../../modules/day-card-notification";
import type { MeResponse } from "./types";

const KEY = "chrono";

export async function getChronoPref() {
  return (await SecureStore.getItemAsync(KEY).catch(() => null)) === "1";
}

export async function setChronoPref(on: boolean) {
  await SecureStore.setItemAsync(KEY, on ? "1" : "0").catch(() => {});
  setChronoNotification(on);
}

/** Kişi saat hesabıyla okuduğu bir grupta mı (ayar yalnızca o zaman görünür) */
export const hasMinutesGroup = (me: Pick<MeResponse, "groups"> | null | undefined) => !!me?.groups.some((g) => g.rules.readUnit === "MINUTES");

/** Uygulama açılınca: ayar açıksa ve saat hesaplı grup varsa kart gösterilir (süre korunur), yoksa kaldırılır */
export async function syncChrono(me: Pick<MeResponse, "groups">) {
  const on = (await getChronoPref()) && hasMinutesGroup(me);
  setChronoNotification(on);
}
