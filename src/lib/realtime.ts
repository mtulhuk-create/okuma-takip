import "server-only";
import { getDb } from "./db";

export type ChatEvent =
  | { type: "message"; message: unknown } // yeni metin mesajı (herkese aynı görünür)
  | { type: "refresh"; reason: "day" | "poll" | "delete" | "card" | "settings" | "money" | "members" | "badge" }; // istemci son sayfayı tazeler

/** Olayı kaydeder; sohbeti açık olan istemciler SSE akışıyla (ya da kısa yoklamayla) anında alır. */
export async function publish(groupId: string, event: ChatEvent) {
  try {
    await getDb().groupEvent.create({ data: { groupId, type: event.type, payload: JSON.stringify(event) } });
  } catch {
    // olay kaydedilemezse istemci periyodik tazelemeyle yakalar
  }
}
