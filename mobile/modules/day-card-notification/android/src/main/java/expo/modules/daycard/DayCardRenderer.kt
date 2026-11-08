package expo.modules.daycard

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject

/**
 * Kilit ekranında duran gün kartı: uygulamadaki gün kartının özü (başlık, kalan süre, ilerleme,
 * kefaret satırı ve renkli butonlar + sayfa/ceza çentikleri). Veriler JS'ten JSON olarak gelir.
 */
object DayCardRenderer {
  private const val PREFS = "okuma_day_card"
  private const val CHANNEL = "today"

  /** JS anahtarı → yerleşimdeki buton yuvası */
  private val SLOTS = mapOf("kefaret" to "kefaret", "all" to "read", "min" to "min", "none" to "none")

  fun notificationId(id: String) = 7000 + (id.hashCode() and 0x7fffffff) % 100000

  fun save(context: Context, p: JSONObject) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(p.getString("id"), p.toString()).apply()
  }

  fun load(context: Context, id: String): JSONObject? =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(id, null)?.let { runCatching { JSONObject(it) }.getOrNull() }

  fun ids(context: Context): Set<String> = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).all.keys

  fun forget(context: Context, id: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(id).apply()
  }

  /** status: butona basıldıktan sonra kısa durum metni ("Gönderiliyor…", "Kaydedildi ✓" ...) */
  fun render(context: Context, p: JSONObject, status: String? = null, silent: Boolean = false) {
    val id = p.getString("id")
    val deadline = p.optLong("deadline")
    val left = deadline - System.currentTimeMillis()
    val nm = NotificationManagerCompat.from(context)
    if (left <= 0) {
      nm.cancel(notificationId(id))
      forget(context, id)
      return
    }
    save(context, p)
    val small = RemoteViews(context.packageName, R.layout.okuma_day_card_small)
    val big = RemoteViews(context.packageName, R.layout.okuma_day_card_big)
    for (v in listOf(small, big)) fill(context, v, p, status, left)

    val icon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName).takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("okumatakip://group/$id")
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val builder = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle(p.optString("title"))
      .setContentText(p.optString("subtitle"))
      .setCustomContentView(small)
      .setCustomBigContentView(big)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(silent)
      .setShowWhen(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setTimeoutAfter(left)
      .setColor(0xFF9B2C2C.toInt())
    // Android 12+ özel görünümleri sistem çerçevesinde gösterir
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setStyle(NotificationCompat.DecoratedCustomViewStyle())
    if (open != null) builder.setContentIntent(PendingIntent.getActivity(context, notificationId(id), open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    try {
      nm.notify(notificationId(id), builder.build())
    } catch (_: SecurityException) {
      // Bildirim izni yok
    }
  }

  private fun fill(context: Context, v: RemoteViews, p: JSONObject, status: String?, left: Long) {
    val id = p.getString("id")
    v.setTextViewText(R.id.title, p.optString("title"))
    val subtitle = listOfNotNull(status, p.optString("subtitle").takeIf { it.isNotEmpty() }).joinToString(" · ")
    runCatching { v.setTextViewText(R.id.subtitle, subtitle) }
    val done = p.optInt("done")
    val total = p.optInt("total")
    v.setTextViewText(R.id.count, "$done/$total")
    // Geri sayım: sistem kendisi saydığı için bildirim güncellenmeden kalan süre akar
    v.setChronometer(R.id.countdown, SystemClock.elapsedRealtime() + left, null, true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) v.setChronometerCountDown(R.id.countdown, true)
    // Yalnızca resmi RemoteViews API'si (desteklenmeyen çağrı bildirimi bozar)
    v.setProgressBar(R.id.progress, maxOf(total, 1), done, false)
    v.setProgressBar(R.id.progress_kef, maxOf(total, 1), p.optInt("kefCount"), false)
    runCatching {
      val line = p.optString("kefaretLine").takeIf { it.isNotEmpty() && it != "null" }
      v.setViewVisibility(R.id.kefaret_line, if (line != null) View.VISIBLE else View.GONE)
      if (line != null) v.setTextViewText(R.id.kefaret_line, line)
    }

    val buttons = p.optJSONArray("buttons")
    val shown = mutableSetOf<String>()
    val state = p.optString("myState")
    if (buttons != null) {
      for (i in 0 until buttons.length()) {
        val b = buttons.getJSONObject(i)
        val key = b.getString("key")
        val slot = SLOTS[key] ?: continue
        shown += slot
        val btn = viewId(context, "btn_$slot")
        v.setViewVisibility(viewId(context, "btn_${slot}_slot"), View.VISIBLE)
        v.setTextViewText(btn, b.optString("label"))
        val on = state == key
        v.setInt(btn, "setBackgroundResource", drawableId(context, if (on) "okuma_btn_${slot}_on" else "okuma_btn_$slot"))
        notch(v, viewId(context, "btn_${slot}_top"), b.optString("top"))
        notch(v, viewId(context, "btn_${slot}_bot"), b.optString("bottom"))
        val intent = Intent(context, DayCardReceiver::class.java).apply {
          action = DayCardReceiver.ACTION
          putExtra("id", id)
          putExtra("choice", key)
          data = Uri.parse("okumatakip://daycard/$id/$key")
        }
        val pi = PendingIntent.getBroadcast(context, notificationId(id) * 4 + i, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        v.setOnClickPendingIntent(btn, pi)
      }
    }
    for (slot in SLOTS.values) if (slot !in shown) v.setViewVisibility(viewId(context, "btn_${slot}_slot"), View.GONE)
  }

  private fun notch(v: RemoteViews, id: Int, text: String?) {
    val t = text?.takeIf { it.isNotEmpty() && it != "null" }
    v.setViewVisibility(id, if (t != null) View.VISIBLE else View.GONE)
    if (t != null) v.setTextViewText(id, t)
  }

  private fun viewId(context: Context, name: String) = context.resources.getIdentifier(name, "id", context.packageName)
  private fun drawableId(context: Context, name: String) = context.resources.getIdentifier(name, "drawable", context.packageName)
}
