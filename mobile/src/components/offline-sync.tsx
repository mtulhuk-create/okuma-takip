import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { ApiError, toast, useApiFetch } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { flushQueue, isNetworkError, loadQueue, queuedItems, type QueuedReport } from "@/lib/offline";

/** Çevrimdışı sıradaki gün kartı işlemlerini internet gelince (açılışta, öne gelince, 20 sn'de bir) gönderir */
export function OfflineSync() {
  const fetcher = useApiFetch();
  const qc = useQueryClient();
  useEffect(() => {
    let alive = true;
    const send = async (item: QueuedReport): Promise<"ok" | "drop" | "retry"> => {
      try {
        if (item.kind === "action") {
          await fetcher(`/api/m/action/reportReading`, { method: "POST", body: JSON.stringify({ ...item.body, at: item.at }) });
          return "ok";
        }
        const res = await fetch(`${API_URL}/api/quick-report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...item.body, at: item.at }) });
        if (res.ok) return "ok";
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast(`Gönderilemedi: ${j.error ?? res.status}`);
        return "drop";
      } catch (e) {
        if (!(e instanceof ApiError) || isNetworkError(e)) return "retry";
        // Sunucu reddetti (ör. süresi çok geçmiş): sıradan çıkar ve haber ver
        toast(`Çevrimdışı işlem gönderilemedi: ${e instanceof ApiError ? e.message : String(e)}`);
        return "drop";
      }
    };
    const run = async () => {
      if (!alive) return;
      await loadQueue();
      if (!queuedItems().length) return;
      const r = await flushQueue(send);
      if (r.sent) {
        toast(`${r.sent} çevrimdışı işlem gönderildi`);
        qc.invalidateQueries();
      }
    };
    run();
    const t = setInterval(run, 20_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && run());
    return () => {
      alive = false;
      clearInterval(t);
      sub.remove();
    };
  }, [fetcher, qc]);
  return null;
}
