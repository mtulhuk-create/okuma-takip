// Android: uygulama arka planda ya da kapalıyken bildirim butonlarını işler.
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { handleReportAction, type ReportData } from "./notifications";

const TASK = "okuma-takip-notification-action";

TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data }) => {
  if (data && "actionIdentifier" in data) {
    const content = data.notification.request.content;
    await handleReportAction(data.actionIdentifier, content.data as ReportData, data.userText).catch(() => {});
  }
  return Notifications.BackgroundNotificationTaskResult.NoData;
});

Notifications.registerTaskAsync(TASK).catch(() => {});
