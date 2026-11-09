package expo.modules.daycard

import android.content.ComponentName
import android.content.pm.PackageManager
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

    // Namaz kaza kartı: son geri alınabilir kılınan (last) korunur
    Function("showKaza") { json: String ->
      val p = JSONObject(json)
      // Kartta son işlem (geri al) ve seçili mod uygulama yenilese de korunur
      KazaCard.load(context)?.let { old ->
        for (k in listOf("last", "lastOp", "mode")) old.optString(k).takeIf { it.isNotEmpty() }?.let { p.put(k, it) }
      }
      KazaCard.render(context, p)
    }

    Function("hideKaza") {
      KazaCard.hide(context)
    }

    // Uygulama simgesi: başlatıcı takma adlarından biri açılır, diğeri kapatılır (light / dark)
    Function("getAppIcon") {
      val pm = context.packageManager
      val dark = ComponentName(context.packageName, "${context.packageName}.IconDark")
      if (pm.getComponentEnabledSetting(dark) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) "dark" else "light"
    }

    Function("setAppIcon") { name: String ->
      val pm = context.packageManager
      val on = if (name == "dark") "IconDark" else "IconLight"
      val off = if (name == "dark") "IconLight" else "IconDark"
      // Önce yenisi açılır ki başlatıcıda simgesiz an olmasın
      pm.setComponentEnabledSetting(ComponentName(context.packageName, "${context.packageName}.$on"), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
      pm.setComponentEnabledSetting(ComponentName(context.packageName, "${context.packageName}.$off"), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
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
