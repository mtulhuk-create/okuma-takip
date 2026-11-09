package expo.modules.daycard

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
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
    // Ceza tek eserde butona yazılır (birden çok eserde günün cezası toplam okumaya göre çıkar)
    val fines = if (books.length() == 1) mapOf("min" to p.optInt("fineMin"), "none" to p.optInt("fineNone")) else emptyMap()
    val count = if (big) books.length() else minOf(1, books.length())
    for (i in 0 until count) {
      val b = books.getJSONObject(i)
      val row = RemoteViews(context.packageName, if (big) R.layout.okuma_book_row else R.layout.okuma_book_row_small)
      val bookId = b.getString("id")
      val target = b.optInt("target")
      val min = b.optInt("min")
      val kefPages = if (b.has("kefPages")) b.optInt("kefPages") else target
      val pages = if (b.isNull("pages")) null else b.optInt("pages")
      row.setTextViewText(R.id.book_title, b.optString("title"))
      if (big) {
        val info = buildString {
          append("Hedef $target sf · alt sınır $min sf")
          if (pages != null) append(" · okunan $pages sf")
        }
        row.setTextViewText(R.id.book_info, info)
      }
      val state = stateOf(kefaretOn, pages, target, min)
      for (btn in BUTTONS) {
        if (btn.key == "kefaret" && !plan) {
          row.setViewVisibility(btn.cell, View.GONE)
          continue
        }
        // Seçili buton dolu ve kenarlı; basılıyken koyulaşır (seçici arka plan)
        val on = state == btn.key || (btn.key == "read" && state == "kefaret")
        row.setInt(btn.button, "setBackgroundResource", if (on) btn.chipOn else btn.chip)
        if (big) {
          row.setImageViewResource(btn.icon, if (on) btn.iconOn else btn.iconOff)
          // 4 buton varken ikon gizlenir, yazı sığsın
          row.setViewVisibility(btn.icon, if (plan) View.GONE else View.VISIBLE)
          row.setTextColor(btn.label, if (on) Color.WHITE else ContextCompat.getColor(context, btn.color))
        } else {
          row.setImageViewResource(btn.button, if (on) btn.iconOn else btn.iconOff)
        }
        // Uygulamadaki gün kartı gibi: sağ üst köşeden çıkan çentik sayfa, sağ alttan çıkan çentik ceza
        val corner = when (btn.key) {
          "kefaret" -> "$kefPages sf"
          "read" -> "$target sf"
          "min" -> "$min sf"
          else -> null
        }
        if (btn.notch != 0) {
          row.setViewVisibility(btn.notch, if (corner != null) View.VISIBLE else View.GONE)
          if (corner != null) row.setTextViewText(btn.notch, corner)
        }
        if (btn.fine != 0) {
          val fine = fines[btn.key] ?: 0
          row.setViewVisibility(btn.fine, if (fine > 0) View.VISIBLE else View.GONE)
          if (fine > 0) row.setTextViewText(btn.fine, "-$fine TL")
        }
        val intent = Intent(context, DayCardReceiver::class.java).apply {
          action = DayCardReceiver.ACTION
          putExtra("id", id)
          when {
            btn.key == "kefaret" -> putExtra("choice", "kefaret")
            // Eser kimliği bilinmiyor (uygulama henüz açılmadı): seçim tüm eserler için gönderilir
            bookId.isEmpty() -> putExtra("choice", if (btn.key == "read") "all" else btn.key)
            else -> {
              putExtra("choice", "all")
              putExtra("bookId", bookId)
              putExtra("bookChoice", btn.key)
            }
          }
          data = Uri.parse("okumatakip://daycard/$id/$bookId/${btn.key}")
        }
        val code = (id + bookId + btn.key).hashCode()
        row.setOnClickPendingIntent(btn.button, PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
      }
      v.addView(R.id.books, row)
    }
  }

  fun stateOf(kefaretOn: Boolean, pages: Int?, target: Int, min: Int): String? = when {
    kefaretOn -> "kefaret"
    pages == null -> null
    pages >= target -> "read"
    pages == 0 -> "none"
    pages >= min -> "min"
    else -> null
  }

  /**
   * Kaynaklar doğrudan R ile anılır: yayın derlemesinde kaynak küçültme yalnızca adla aranan
   * (getIdentifier) çizimleri siler; seçili butonun kaybolması bundandı.
   */
  private class Btn(val key: String, val cell: Int, val button: Int, val icon: Int, val label: Int, val notch: Int, val fine: Int, val chip: Int, val chipOn: Int, val iconOff: Int, val iconOn: Int, val color: Int)
  private val BUTTONS = listOf(
    Btn("kefaret", R.id.c_kefaret, R.id.b_kefaret, R.id.i_kefaret, R.id.l_kefaret, R.id.n_kefaret, 0, R.drawable.okuma_chip_kefaret, R.drawable.okuma_chip_kefaret_on, R.drawable.okuma_ic_kefaret, R.drawable.okuma_ic_kefaret_on, R.color.okuma_kefaret),
    Btn("read", R.id.c_read, R.id.b_read, R.id.i_read, R.id.l_read, R.id.n_read, 0, R.drawable.okuma_chip_read, R.drawable.okuma_chip_read_on, R.drawable.okuma_ic_read, R.drawable.okuma_ic_read_on, R.color.okuma_read),
    Btn("min", R.id.c_min, R.id.b_min, R.id.i_min, R.id.l_min, R.id.n_min, R.id.f_min, R.drawable.okuma_chip_min, R.drawable.okuma_chip_min_on, R.drawable.okuma_ic_min, R.drawable.okuma_ic_min_on, R.color.okuma_min),
    Btn("none", R.id.c_none, R.id.b_none, R.id.i_none, R.id.l_none, 0, R.id.f_none, R.drawable.okuma_chip_none, R.drawable.okuma_chip_none_on, R.drawable.okuma_ic_none, R.drawable.okuma_ic_none_on, R.color.okuma_none),
  )
}
