// Android: uygulama arka planda ya da kapalıyken bildirim butonlarını işler.
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { handleReportAction, type ReportData } from "./notifications";

const TASK = "okuma-takip-notification-action";

type RawContent = { data?: unknown; dataString?: string };

/**
 * Arka plan görevine gelen ham bildirimde yerel bildirimin verisi `data` yerine
 * `dataString` (JSON metni) olarak gelir; ikisini de okuyalım.
 */
function contentData(content: RawContent | undefined): Partial<ReportData> | null {
  if (!content) return null;
  if (content.data && typeof content.data === "object" && "token" in (content.data as object)) return content.data as ReportData;
  if (typeof content.dataString === "string") {
    try {
      return JSON.parse(content.dataString) as ReportData;
    } catch {
      return null;
    }
  }
  return null;
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data }) => {
  if (data && "actionIdentifier" in data) {
    const n = data.notification as unknown as { date?: number; request?: { identifier?: string; content?: RawContent } } | undefined;
    const payload = contentData(n?.request?.content);
    if (payload?.token) {
      const key = `${n?.request?.identifier}:${data.actionIdentifier}:${n?.date ?? ""}`;
      await handleReportAction(data.actionIdentifier, payload as ReportData, data.userText, key).catch(() => {});
    }
  }
  return Notifications.BackgroundNotificationTaskResult.NoData;
});

Notifications.registerTaskAsync(TASK).catch(() => {});
