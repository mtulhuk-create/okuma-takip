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
    fill(context, small, p, status, left, big = false)
    fill(context, big, p, status, left, big = true)

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

  private fun fill(context: Context, v: RemoteViews, p: JSONObject, status: String?, left: Long, big: Boolean) {
    val id = p.getString("id")
    v.setTextViewText(R.id.title, p.optString("title"))
    val subtitle = listOfNotNull(status, p.optString("subtitle").takeIf { it.isNotEmpty() }).joinToString(" · ")
    v.setTextViewText(R.id.subtitle, subtitle)
    val done = p.optInt("done")
    val total = p.optInt("total")
    v.setTextViewText(R.id.count, "$done/$total")
    // Geri sayım: sistem kendisi saydığı için bildirim güncellenmeden kalan süre akar
    v.setChronometer(R.id.countdown, SystemClock.elapsedRealtime() + left, null, true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) v.setChronometerCountDown(R.id.countdown, true)
    // Yalnızca resmi RemoteViews API'si (desteklenmeyen çağrı bildirimi bozar)
    v.setProgressBar(R.id.progress, maxOf(total, 1), done, false)
    v.setProgressBar(R.id.progress_kef, maxOf(total, 1), p.optInt("kefCount"), false)
    val line = p.optString("kefaretLine").takeIf { it.isNotEmpty() && it != "null" }
    v.setViewVisibility(R.id.kefaret_line, if (line != null) View.VISIBLE else View.GONE)
    if (line != null) v.setTextViewText(R.id.kefaret_line, line)

    // Eserler ve küçük butonları (kapalı kartta yalnızca ilk eser)
    v.removeAllViews(R.id.books)
    val books = p.optJSONArray("books") ?: return
    val plan = p.optBoolean("plan")
    val kefaretOn = p.optBoolean("kefaretOn")
    val count = if (big) books.length() else minOf(1, books.length())
    for (i in 0 until count) {
      val b = books.getJSONObject(i)
      val row = RemoteViews(context.packageName, if (big) R.layout.okuma_book_row else R.layout.okuma_book_row_small)
      val bookId = b.getString("id")
      val target = b.optInt("target")
      val min = b.optInt("min")
      val pages = if (b.isNull("pages")) null else b.optInt("pages")
      row.setTextViewText(R.id.book_title, b.optString("title"))
      if (big) {
        val info = buildString {
          append("Hedef $target · alt sınır $min")
          if (pages != null) append(" · $pages sf")
          if (plan && b.has("kefPages")) append(" · kefaret ${b.optInt("kefPages")}")
        }
        row.setTextViewText(R.id.book_info, info)
      }
      val state = when {
        kefaretOn -> "kefaret"
        pages == null -> null
        pages >= target -> "read"
        pages == 0 -> "none"
        pages >= min -> "min"
        else -> null
      }
      for ((k, viewName) in listOf("kefaret" to "b_kefaret", "read" to "b_read", "min" to "b_min", "none" to "b_none")) {
        val vid = viewId(context, viewName)
        if (k == "kefaret" && !plan) {
          row.setViewVisibility(vid, View.GONE)
          continue
        }
        val on = state == k || (k == "read" && state == "kefaret")
        row.setInt(vid, "setBackgroundResource", drawableId(context, if (on) "okuma_chip_${k}_on" else "okuma_chip_$k"))
        row.setImageViewResource(vid, drawableId(context, if (on) "okuma_ic_${k}_on" else "okuma_ic_$k"))
        val intent = Intent(context, DayCardReceiver::class.java).apply {
          action = DayCardReceiver.ACTION
          putExtra("id", id)
          if (k == "kefaret") putExtra("choice", "kefaret") else {
            putExtra("choice", "all")
            putExtra("bookId", bookId)
            putExtra("bookChoice", k)
          }
          data = Uri.parse("okumatakip://daycard/$id/$bookId/$k")
        }
        val code = (id + bookId + k).hashCode()
        row.setOnClickPendingIntent(vid, PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
      }
      v.addView(R.id.books, row)
    }
  }

  private fun viewId(context: Context, name: String) = context.resources.getIdentifier(name, "id", context.packageName)
  private fun drawableId(context: Context, name: String) = context.resources.getIdentifier(name, "drawable", context.packageName)
}
