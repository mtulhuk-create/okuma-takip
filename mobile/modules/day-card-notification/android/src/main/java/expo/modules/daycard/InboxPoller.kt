package expo.modules.daycard

import android.app.ActivityManager
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Uygulama kapalıyken gruplara yazılan mesajları bildirir. Tamamen yerel çalışır (JS başlatmaz):
 * sistem yaklaşık 15 dakikada bir (pil tasarrufuna göre) uyandırır, sunucudan yeni mesajları
 * imzalı mesaj token'ıyla okur ve grup başına tek bildirim gösterir.
 */
object InboxPoller {
  private const val PREFS = "okuma_inbox"
  const val ACTION_POLL = "expo.modules.daycard.INBOX_POLL"
  private const val CHANNEL = "messages"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun intent(context: Context): PendingIntent {
    val i = Intent(context, InboxReceiver::class.java).setAction(ACTION_POLL)
    return PendingIntent.getBroadcast(context, 7301, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  /** JS ayarlar: sunucu adresi, token ve aç/kapa. Kapalıysa ya da token yoksa alarm kaldırılır */
  fun configure(context: Context, apiUrl: String, token: String, enabled: Boolean) {
    prefs(context).edit().putString("apiUrl", apiUrl).putString("token", token).putBoolean("enabled", enabled).apply()
    arm(context)
  }

  /** Uygulamada görülen mesajlar sonradan bildirilmesin: bu andan sonrası */
  fun setAfter(context: Context, iso: String) {
    prefs(context).edit().putString("after", iso).apply()
  }

  fun arm(context: Context) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val p = prefs(context)
    val pi = intent(context)
    am.cancel(pi)
    if (!p.getBoolean("enabled", false) || p.getString("token", "").isNullOrEmpty()) return
    // Kesin olmayan alarm: sistem diğer uyanmalarla birleştirir, pili yormaz
    am.setInexactRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + AlarmManager.INTERVAL_FIFTEEN_MINUTES, AlarmManager.INTERVAL_FIFTEEN_MINUTES, pi)
  }

  private fun nowIso(): String {
    val f = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
    f.timeZone = java.util.TimeZone.getTimeZone("UTC")
    return f.format(java.util.Date())
  }

  private fun appInForeground(context: Context): Boolean {
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val me = am.runningAppProcesses?.firstOrNull { it.processName == context.packageName } ?: return false
    return me.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  }

  /** Arka planda çağrılır (ana iş parçacığında değil) */
  fun poll(context: Context) {
    val p = prefs(context)
    if (!p.getBoolean("enabled", false)) return
    // Uygulama açıkken mesajlar uygulamanın kendisi tarafından kontrol ediliyor
    if (appInForeground(context)) return
    val api = p.getString("apiUrl", null) ?: return
    val token = p.getString("token", null)?.takeIf { it.isNotEmpty() } ?: return
    val after = p.getString("after", null) ?: nowIso().also { setAfter(context, it) }
    val conn = (URL("$api/api/inbox?after=${URLEncoder.encode(after, "UTF-8")}").openConnection() as HttpURLConnection).apply {
      connectTimeout = 15_000
      readTimeout = 15_000
      setRequestProperty("authorization", "Inbox $token")
    }
    try {
      if (conn.responseCode != 200) return
      val body = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
      setAfter(context, body.optString("now", after))
      val list = body.optJSONArray("messages") ?: return
      showAll(context, list)
    } finally {
      conn.disconnect()
    }
  }

  private fun parseTime(iso: String): Long = runCatching {
    val f = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
    f.timeZone = java.util.TimeZone.getTimeZone("UTC")
    f.parse(iso)?.time
  }.getOrNull() ?: System.currentTimeMillis()

  /** Mesajları grup başına ayırıp gösterir (JS de uygulama açıkken bunu kullanır) */
  fun showAll(context: Context, list: org.json.JSONArray, skipGroupId: String? = null) {
    val groups = LinkedHashMap<String, MutableList<JSONObject>>()
    for (i in 0 until list.length()) {
      val m = list.optJSONObject(i) ?: continue
      val gid = m.optString("groupId")
      if (gid.isEmpty() || gid == skipGroupId) continue
      groups.getOrPut(gid) { mutableListOf() }.add(m)
    }
    for ((groupId, msgs) in groups) show(context, groupId, msgs)
  }

  fun dismiss(context: Context, groupId: String) {
    (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel("msg-$groupId", 0)
  }

  /**
   * Grup sohbeti bildirimi (WhatsApp grubu gibi): başlıkta grup adı, altında "kişi: mesaj" satırları.
   * Aynı grubun bildirimi duruyorsa yeni mesajlar ona eklenir.
   */
  private fun show(context: Context, groupId: String, msgs: List<JSONObject>) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(NotificationChannel(CHANNEL, "Grup mesajları", NotificationManager.IMPORTANCE_HIGH))
    }
    val tag = "msg-$groupId"
    val name = msgs.first().optString("groupName")
    val existing = runCatching { nm.activeNotifications.firstOrNull { it.tag == tag && it.id == 0 }?.notification }.getOrNull()
    val style = existing?.let { runCatching { NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(it) }.getOrNull() }
      ?: NotificationCompat.MessagingStyle(Person.Builder().setName("Sen").build())
    style.setConversationTitle(name).setGroupConversation(true)
    for (m in msgs) {
      val author = m.optString("author").ifEmpty { name }
      style.addMessage(m.optString("text"), parseTime(m.optString("createdAt")), Person.Builder().setName(author).setKey("$groupId:$author").build())
    }
    val open = Intent(Intent.ACTION_VIEW, Uri.parse("okumatakip://group/$groupId")).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val pi = PendingIntent.getActivity(context, groupId.hashCode(), open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val icon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName).takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
    val n = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(icon)
      .setColor(0xFF9B2C2C.toInt())
      .setStyle(style)
      .setNumber(style.messages.size)
      .setContentIntent(pi)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .build()
    // Uygulamanın kendi mesaj bildirimiyle aynı yer (etiket msg-grup, kimlik 0): sohbet açılınca kaldırılır
    nm.notify(tag, 0, n)
  }
}

/** Mesaj kontrol alarmı: ağ isteği ayrı iş parçacığında, alıcı süresi içinde biter */
class InboxReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != InboxPoller.ACTION_POLL) return
    val pending = goAsync()
    Thread {
      try {
        InboxPoller.poll(context.applicationContext)
      } catch (_: Throwable) {
        // Hiçbir hata uygulamayı çökertmesin
      } finally {
        pending.finish()
      }
    }.start()
  }
}
