// Anlık bildirim (Firebase): cihaz kaydı sunucuya bildirilir; mesajlar, sabit kartın güncellenmesi ve
// hatırlatma iptalleri sunucudan anında gelir. Firebase ayarlı değilse hiçbir şey yapmaz (aralıklı kontrol sürer).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPushToken, setNativePushActive } from "../../modules/day-card-notification";

const KEY = "push-token";

/** Bu oturumda anlık bildirim kaydı başarılı mı (yedek kontrollerin sıklığı buna göre) */
let active = false;
export const pushActive = () => active;
type Fetcher = <T>(path: string, init?: RequestInit) => Promise<T>;

/** Giriş yapılınca ve uygulama her açıldığında: kayıt yenilenmiş olabilir */
export async function registerPushDevice(fetcher: Fetcher) {
  const token = await getPushToken();
  if (!token) return false;
  await fetcher("/api/m/push-device", { method: "POST", body: JSON.stringify({ token }) });
  await AsyncStorage.setItem(KEY, token).catch(() => {});
  active = true;
  setNativePushActive(true);
  return true;
}

/** Çıkış yaparken (oturum kapanmadan önce): bu telefona artık bu hesabın bildirimi gelmesin */
export async function unregisterPushDevice(fetcher: Fetcher) {
  const token = (await AsyncStorage.getItem(KEY).catch(() => null)) ?? (await getPushToken());
  if (!token) return;
  await fetcher("/api/m/push-device", { method: "DELETE", body: JSON.stringify({ token }) }).catch(() => {});
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
