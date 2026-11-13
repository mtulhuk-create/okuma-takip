package expo.modules.daycard

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * Gün başında kartı uygulama açılmadan gösterir: JS sonraki okuma günlerinin kartlarını buraya verir,
 * her biri için sistem alarmı kurulur. Butonlar yerel olduğundan uygulama hiç açılmasa da çalışır.
 */
object DayCardScheduler {
  private const val PREFS = "okuma_day_card_plan"
  private const val KEY = "items"
  const val ACTION_SHOW = "expo.modules.daycard.SHOW"

  private fun keyOf(p: JSONObject) = "${p.optString("id")}|${p.optString("dayKey")}"

  private fun items(context: Context): List<JSONObject> {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return emptyList()
    val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
    return (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }
  }

  private fun intent(context: Context, key: String): PendingIntent {
    val i = Intent(context, DayCardAlarmReceiver::class.java).setAction(ACTION_SHOW).putExtra("key", key)
    return PendingIntent.getBroadcast(context, key.hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  /** Planı değiştirir: eski alarmlar kaldırılır, gelecekteki günler için yenileri kurulur */
  fun schedule(context: Context, list: JSONArray) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    for (old in items(context)) am.cancel(intent(context, keyOf(old)))
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, list.toString()).apply()
    arm(context, showOpen = false)
  }

  /** Alarmları kurar; showOpen: açılışta (yeniden başlatma) şu an açık olan günün kartını da gösterir */
  fun arm(context: Context, showOpen: Boolean) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val now = System.currentTimeMillis()
    for (p in items(context)) {
      val start = p.optLong("start")
      val deadline = p.optLong("deadline")
      if (deadline <= now) continue
      if (start > now) {
        val pi = intent(context, keyOf(p))
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, start, pi)
          else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, start, pi)
        } catch (_: SecurityException) {
          am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, start, pi)
        }
      } else if (showOpen) show(context, keyOf(p))
    }
  }

  /** Kartı gösterir; uygulama aynı gün için daha güncel bir kart çizdiyse o kullanılır */
  fun show(context: Context, key: String) {
    val p = items(context).firstOrNull { keyOf(it) == key } ?: return
    val current = DayCardRenderer.load(context, p.optString("id"))
    val card = if (current != null && current.optString("dayKey") == p.optString("dayKey")) current else JSONObject(p.toString()).apply { remove("start") }
    DayCardRenderer.render(context, card)
  }
}

/** Gün başı alarmı */
class DayCardAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == DayCardScheduler.ACTION_SHOW) DayCardScheduler.show(context, intent.getStringExtra("key") ?: return)
  }
}

/** Telefon yeniden başlayınca (ya da uygulama güncellenince) alarmlar silinir: yeniden kurulur */
class DayCardBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      DayCardScheduler.arm(context, showOpen = true)
      runCatching { InboxPoller.arm(context) }
      runCatching { ChronoCard.render(context) }
    }
  }
}
