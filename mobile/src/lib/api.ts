import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Platform, ToastAndroid } from "react-native";
import { API_URL } from "./config";
import { APP_VARIANT } from "./variant";
import { showCardNotice } from "./card-notice";
import { enqueue, isNetworkError } from "./offline";
import type { ActionResult } from "./types";
import { showAlert } from "./dialog";

/** Sıradaki işlem için kısa açıklama */
export function reportLabel(body: Record<string, unknown>) {
  const c = String(body.bookChoice ?? body.choice ?? "");
  return { all: "Okudum", read: "Okudum", min: "Alt sınırı okudum", none: "Okumadım", pages: "Sayfa bildirimi", kefaret: "Kefaret okuması" }[c] ?? "Bildirim";
}

export class ApiError extends Error {}

/** Clerk oturum token'ını ekleyerek sunucuya istek atar. */
export function useApiFetch() {
  const { getToken } = useAuth();
  return useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken().catch(() => null);
      let res: Response;
      try {
        res = await fetch(API_URL + path, {
          ...init,
          headers: { "content-type": "application/json", "x-app-variant": APP_VARIANT, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
        });
      } catch {
        // Sunucuya ulaşılamadı: anlaşılır mesaj (çevrimdışı sıra bu hatayı ağ hatası sayar)
        throw new Error("İnternet bağlantısı yok. Bağlanınca tekrar dene.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError((data as ActionResult).error ?? `Sunucu hatası (${res.status})`);
      return data as T;
    },
    [getToken],
  );
}

export function useApi<T>(path: string, opts: { enabled?: boolean } = {}) {
  const fetcher = useApiFetch();
  return useQuery<T>({ queryKey: [path], queryFn: () => fetcher<T>(path), enabled: opts.enabled });
}

export function toast(message: string) {
  if (Platform.OS === "android") ToastAndroid.show(message, ToastAndroid.SHORT);
  else showAlert(message);
}

/** Web'deki server action'ların mobil karşılığı. Başarıda tüm verileri tazeler. */
export function useAction() {
  const fetcher = useApiFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, body }: { name: string; body?: Record<string, unknown> }) => {
      try {
        return await fetcher<ActionResult>(`/api/m/action/${name}`, { method: "POST", body: JSON.stringify(body ?? {}) });
      } catch (e) {
        // İnternet yokken gün kartı işlemi sıraya alınır; bağlanınca işlemin yapıldığı anla gönderilir
        // Sunucudan yanıt gelmediyse (ApiError değilse) internet yok sayılır
        if (name === "reportReading" && body?.groupId && body?.dayKey && (!(e instanceof ApiError) || isNetworkError(e))) {
          await enqueue({ kind: "action", groupId: String(body.groupId), dayKey: String(body.dayKey), label: reportLabel(body), body });
          return { ok: true, message: "İnternet yok: işlem kaydedildi, bağlanınca gönderilecek" } as ActionResult;
        }
        throw e;
      }
    },
    onSuccess: (res, { name, body }) => {
      // Okuma bildirimi sonucu sistem kutusunda değil, gün kartının tepesinde kısa bir bilgiyle gösterilir
      if (res.message && name === "reportReading" && body?.groupId) showCardNotice(String(body.groupId), res.message);
      else if (res.message) toast(res.message);
      qc.invalidateQueries();
    },
    onError: (e) => showAlert("İşlem yapılamadı", e.message),
  });
}
