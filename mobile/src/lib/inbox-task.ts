// Uygulama kapalıyken grup mesajlarını aralıklarla kontrol eden arka plan görevi
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { checkInbox } from "./inbox";

const TASK = "okuma-takip-inbox";

TaskManager.defineTask(TASK, async () => {
  await checkInbox().catch(() => 0);
  return BackgroundTask.BackgroundTaskResult.Success;
});

/** Mesaj bildirimi açıksa görevi kurar, kapalıysa kaldırır */
export async function setInboxTask(on: boolean) {
  const registered = await TaskManager.isTaskRegisteredAsync(TASK).catch(() => false);
  if (on && !registered) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 }).catch(() => {});
  if (!on && registered) await BackgroundTask.unregisterTaskAsync(TASK).catch(() => {});
}
