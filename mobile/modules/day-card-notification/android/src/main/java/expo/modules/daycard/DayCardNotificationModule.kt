package expo.modules.daycard

import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class DayCardNotificationModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext) { "React context yok" }

  override fun definition() = ModuleDefinition {
    Name("DayCardNotification")

    Function("show") { json: String ->
      DayCardRenderer.render(context, JSONObject(json))
    }

    // Sonraki okuma günlerinin kartları: gün başında uygulama açılmadan gösterilir
    Function("schedule") { json: String ->
      DayCardScheduler.schedule(context, JSONArray(json))
    }

    Function("hide") { id: String ->
      NotificationManagerCompat.from(context).cancel(DayCardRenderer.notificationId(id))
      DayCardRenderer.forget(context, id)
    }

    Function("hideAll") {
      val nm = NotificationManagerCompat.from(context)
      for (id in DayCardRenderer.ids(context)) {
        nm.cancel(DayCardRenderer.notificationId(id))
        DayCardRenderer.forget(context, id)
      }
    }
  }
}
