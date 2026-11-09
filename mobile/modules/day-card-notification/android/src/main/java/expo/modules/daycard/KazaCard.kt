package expo.modules.daycard

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.NumberFormat
import java.util.Locale

/**
 * Bildirim panelindeki namaz kaza kartı: vakit butonuna basınca uygulama açılmadan "kaza kılındı" sunucuya gider,
 * kalan sayı kartta hemen düşer. Veriler JS'ten JSON olarak gelir.
 */
object KazaCard {
  private const val PREFS = "okuma_kaza_card"
  private const val CHANNEL = "kaza"
  const val NOTIFICATION_ID = 6999
  const val ACTION = "expo.modules.daycard.KAZA"
  val PRAYERS = listOf("sabah", "ogle", "ikindi", "aksam", "yatsi", "vitir")

  // Kaynaklar doğrudan R ile anılır (yayın derlemesinde adla aranan kaynaklar silinebiliyor)
  private val BUTTON = mapOf("sabah" to R.id.kb_sabah, "ogle" to R.id.kb_ogle, "ikindi" to R.id.kb_ikindi, "aksam" to R.id.kb_aksam, "yatsi" to R.id.kb_yatsi, "vitir" to R.id.kb_vitir)
  private val COUNT = mapOf("sabah" to R.id.kc_sabah, "ogle" to R.id.kc_ogle, "ikindi" to R.id.kc_ikindi, "aksam" to R.id.kc_aksam, "yatsi" to R.id.kc_yatsi, "vitir" to R.id.kc_vitir)

  fun save(context: Context, p: JSONObject) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("card", p.toString()).apply()
  fun load(context: Context): JSONObject? = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("card", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

  fun hide(context: Context) {
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
  }

  private fun fmt(n: Int) = NumberFormat.getIntegerInstance(Locale("tr", "TR")).format(n)

  fun render(context: Context, p: JSONObject, status: String? = null) {
    save(context, p)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = context.getSystemService(NotificationManager::class.java)
      if (nm.getNotificationChannel(CHANNEL) == null) {
        // Sessiz ama görünür: kilit ekranında ve panelde normal bildirim gibi durur
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Namaz kaza kartı", NotificationManager.IMPORTANCE_DEFAULT).apply {
          description = "Bildirim panelinde kaza namazlarını işaretleme kartı"
          setSound(null, null)
          enableVibration(false)
          setShowBadge(false)
        })
      }
    }
    val v = RemoteViews(context.packageName, R.layout.okuma_kaza_card)
    val remaining = p.optJSONObject("remaining") ?: JSONObject()
    val total = PRAYERS.sumOf { remaining.optInt(it) }
    val today = p.optInt("today")
    val goal = p.optInt("goal")
    v.setTextViewText(R.id.k_total, "${fmt(total)} kalan · bugün ${if (goal > 0) "$today/$goal" else "$today"}")
    v.setViewVisibility(R.id.k_status, if (status != null) View.VISIBLE else View.GONE)
    if (status != null) v.setTextViewText(R.id.k_status, status)
    for (k in PRAYERS) {
      v.setTextViewText(COUNT.getValue(k), fmt(remaining.optInt(k)))
      v.setOnClickPendingIntent(BUTTON.getValue(k), intent(context, k))
    }
    // Son kılınan geri alınabilir
    val last = p.optString("last").takeIf { it in PRAYERS }
    v.setViewVisibility(R.id.k_undo, if (last != null) View.VISIBLE else View.GONE)
    v.setOnClickPendingIntent(R.id.k_undo, intent(context, "undo"))

    val icon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName).takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
    val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("okumatakip://kaza")
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val builder = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle("Kaza namazları")
      .setContentText("${fmt(total)} kalan")
      .setCustomContentView(v)
      .setCustomBigContentView(v)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setColor(0xFF4F46E5.toInt())
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setStyle(NotificationCompat.DecoratedCustomViewStyle())
    if (open != null) builder.setContentIntent(PendingIntent.getActivity(context, NOTIFICATION_ID, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
    } catch (_: SecurityException) {
      // Bildirim izni yok
    }
  }

  private fun intent(context: Context, what: String): PendingIntent {
    val i = Intent(context, KazaReceiver::class.java).setAction(ACTION).putExtra("what", what).setData(Uri.parse("okumatakip://kaza/$what"))
    return PendingIntent.getBroadcast(context, ("kaza$what").hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }
}

/** Kaza kartı butonları: önce kartta düşer, sonra sunucuya gider; hata olursa eski hâline döner */
class KazaReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val what = intent.getStringExtra("what") ?: return
    val p = KazaCard.load(context) ?: return
    val undo = what == "undo"
    val prayer = if (undo) p.optString("last").takeIf { it in KazaCard.PRAYERS } ?: return else what.takeIf { it in KazaCard.PRAYERS } ?: return
    val labels = p.optJSONObject("labels")
    val label = labels?.optString(prayer)?.takeIf { it.isNotEmpty() } ?: prayer
    val before = JSONObject(p.toString())
    val remaining = p.optJSONObject("remaining") ?: JSONObject().also { p.put("remaining", it) }
    if (!undo && remaining.optInt(prayer) <= 0) {
      KazaCard.render(context, p, "$label kazası kalmadı")
      return
    }
    remaining.put(prayer, remaining.optInt(prayer) + if (undo) 1 else -1)
    p.put("today", maxOf(0, p.optInt("today") + if (undo) -1 else 1))
    if (undo) p.remove("last") else p.put("last", prayer)
    val pending = goAsync()
    KazaCard.render(context, p, "Gönderiliyor…")
    Thread {
      try {
        val (ok, res) = post(p.optString("apiUrl"), p.optString("token"), if (undo) "undo" else "make", prayer)
        if (ok && res != null) {
          res.optJSONObject("remaining")?.let { p.put("remaining", it) }
          p.put("today", res.optInt("today", p.optInt("today")))
          p.put("goal", res.optInt("dailyGoal", p.optInt("goal")))
          KazaCard.render(context, p, if (undo) "$label geri alındı" else "$label kılındı ✓")
        } else {
          KazaCard.render(context, before, res?.optString("error")?.takeIf { it.isNotEmpty() } ?: "Kaydedilemedi")
        }
      } catch (_: Throwable) {
        KazaCard.render(context, before, "İnternet yok")
      } finally {
        pending.finish()
      }
    }.start()
  }

  private fun post(apiUrl: String, token: String, op: String, prayer: String): Pair<Boolean, JSONObject?> {
    val conn = URL("${apiUrl.trimEnd('/')}/api/kaza/quick").openConnection() as HttpURLConnection
    return try {
      conn.requestMethod = "POST"
      conn.connectTimeout = 10_000
      conn.readTimeout = 10_000
      conn.doOutput = true
      conn.setRequestProperty("content-type", "application/json")
      conn.setRequestProperty("x-app-variant", "full")
      val body = JSONObject().put("token", token).put("op", op).put("prayer", prayer).toString()
      conn.outputStream.use { it.write(body.toByteArray()) }
      val code = conn.responseCode
      val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
      (code in 200..299) to runCatching { JSONObject(text) }.getOrNull()
    } finally {
      conn.disconnect()
    }
  }
}
