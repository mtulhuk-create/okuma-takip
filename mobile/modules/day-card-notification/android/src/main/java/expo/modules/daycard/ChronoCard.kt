package expo.modules.daycard

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Bildirim panelindeki kronometre (saat hesabıyla okuyanlar için, ayardan açılır): okuma süresini ölçmeye yarar,
 * okuma bildirimine bağlı değildir. Süreyi sistem sayar (her saniye bildirim güncellenmez, pili yormaz);
 * yalnızca butonlara basınca kart yeniden çizilir. Durum duvar saatiyle saklanır, telefon yeniden başlasa da korunur.
 */
object ChronoCard {
  private const val PREFS = "okuma_chrono"
  private const val CHANNEL = "kronometre"
  const val NOTIFICATION_ID = 6998
  const val ACTION = "expo.modules.daycard.CHRONO"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Geçen süre (ms): çalışıyorsa başlangıçtan bu yana, duraklatıldıysa birikmiş süre */
  private fun elapsed(context: Context): Long {
    val p = prefs(context)
    val acc = p.getLong("acc", 0L)
    val since = p.getLong("since", 0L)
    return if (since > 0) acc + (System.currentTimeMillis() - since).coerceAtLeast(0) else acc
  }

  private fun running(context: Context) = prefs(context).getLong("since", 0L) > 0

  fun isEnabled(context: Context) = prefs(context).getBoolean("enabled", false)

  /** Kartı gösterir (ayar açılınca ya da uygulama/telefon açılışında); süreyi sıfırlamaz */
  fun show(context: Context) {
    prefs(context).edit().putBoolean("enabled", true).apply()
    render(context)
  }

  /** Ayar kapatılınca: kart kalkar, süre sıfırlanır */
  fun hide(context: Context) {
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    prefs(context).edit().clear().apply()
  }

  fun onAction(context: Context, what: String) {
    val p = prefs(context)
    when (what) {
      "toggle" -> if (running(context)) p.edit().putLong("acc", elapsed(context)).putLong("since", 0L).apply()
      else p.edit().putLong("since", System.currentTimeMillis()).apply()
      "reset" -> p.edit().putLong("acc", 0L).putLong("since", 0L).apply()
    }
    render(context)
  }

  fun render(context: Context) {
    if (!isEnabled(context)) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = context.getSystemService(NotificationManager::class.java)
      if (nm.getNotificationChannel(CHANNEL) == null) {
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Kronometre", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Okuma süresini ölçmek için bildirim panelinde duran kronometre"
          setSound(null, null)
          enableVibration(false)
          setShowBadge(false)
        })
      }
    }
    val on = running(context)
    val ms = elapsed(context)
    val v = RemoteViews(context.packageName, R.layout.okuma_chrono_card)
    // Chronometer tabanı: çalışırken sistem sayar; duraklatıldıysa birikmiş süre donuk gösterilir
    v.setChronometer(R.id.ch_time, SystemClock.elapsedRealtime() - ms, null, on)
    v.setTextViewText(R.id.ch_toggle, if (on) "Durdur" else if (ms > 0) "Devam" else "Başlat")
    v.setOnClickPendingIntent(R.id.ch_toggle, intent(context, "toggle"))
    v.setOnClickPendingIntent(R.id.ch_reset, intent(context, "reset"))

    val icon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName).takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
    val builder = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle("Kronometre")
      .setSubText(if (on) "Çalışıyor" else if (ms > 0) "Duraklatıldı" else "Okuma süreni ölç")
      .setCustomContentView(v)
      .setCustomBigContentView(v)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setColor(0xFF9B2C2C.toInt())
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      builder.setContentIntent(PendingIntent.getActivity(context, NOTIFICATION_ID, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    }
    try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
    } catch (_: SecurityException) {
      // Bildirim izni yok
    }
  }

  private fun intent(context: Context, what: String): PendingIntent {
    val i = Intent(context, ChronoReceiver::class.java).setAction(ACTION).putExtra("what", what).setData(Uri.parse("okumatakip://chrono/$what"))
    return PendingIntent.getBroadcast(context, ("chrono$what").hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }
}

/** Kronometre butonları (uygulama açılmadan) */
class ChronoReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ChronoCard.ACTION) return
    runCatching { ChronoCard.onAction(context, intent.getStringExtra("what") ?: return) }
  }
}
