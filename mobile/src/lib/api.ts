import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";
import { API_URL } from "./config";
import type { ActionResult } from "./types";

export class ApiError extends Error {}

/** Clerk oturum token'ını ekleyerek sunucuya istek atar. */
export function useApiFetch() {
  const { getToken } = useAuth();
  return useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      const res = await fetch(API_URL + path, {
        ...init,
        headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
      });
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
  else Alert.alert(message);
}

/** Web'deki server action'ların mobil karşılığı. Başarıda tüm verileri tazeler. */
export function useAction() {
  const fetcher = useApiFetch();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body?: Record<string, unknown> }) =>
      fetcher<ActionResult>(`/api/m/action/${name}`, { method: "POST", body: JSON.stringify(body ?? {}) }),
    onSuccess: (res) => {
      if (res.message) toast(res.message);
      qc.invalidateQueries();
    },
    onError: (e) => Alert.alert("İşlem yapılamadı", e.message),
  });
}
