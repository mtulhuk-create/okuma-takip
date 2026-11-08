// Hata kaydı: uygulamayı kapatan JavaScript hatası cihazda saklanır, bir sonraki açılışta gösterilir.
// Böylece "uygulama sürekli duruyor" durumunda sebebi ekran görüntüsüyle iletilebilir.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const KEY = "last-crash";
type Crash = { at: number; fatal: boolean; msg: string; stack: string };

export function installCrashLogger() {
  const eu = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    if (fatal) {
      try {
        const err = e as { message?: string; stack?: string } | undefined;
        const crash: Crash = { at: Date.now(), fatal: true, msg: String(err?.message ?? e).slice(0, 300), stack: String(err?.stack ?? "").slice(0, 1200) };
        // Senkron yazılır: süreç kapanmadan kaydedilsin
        SecureStore.setItem(KEY, JSON.stringify(crash));
      } catch {}
    }
    prev?.(e, fatal);
  });
}

/** Son kaydedilen hatayı (JS ya da yerel/Android) bir kez döndürür ve siler */
export async function takeLastCrash(): Promise<Crash | null> {
  // Yerel çökme: plugins/with-crash-log.js AsyncStorage veritabanına yazar
  try {
    const raw = await AsyncStorage.getItem("native-crash");
    if (raw) {
      await AsyncStorage.removeItem("native-crash");
      const n = JSON.parse(raw) as { at: number; thread?: string; stack: string };
      const first = n.stack.split("\n")[0] ?? "";
      return { at: n.at, fatal: true, msg: `Android: ${first}`, stack: `[${n.thread ?? "?"}] ${n.stack}` };
    }
  } catch {}
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    await SecureStore.deleteItemAsync(KEY);
    return JSON.parse(raw) as Crash;
  } catch {
    return null;
  }
}
