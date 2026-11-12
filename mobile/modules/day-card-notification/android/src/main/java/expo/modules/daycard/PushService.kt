package expo.modules.daycard

import android.content.Context
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.NotificationsService
import org.json.JSONArray
import org.json.JSONObject

/**
 * Sunucudan anında gelen veri mesajları (Firebase). Uygulama kapalıyken de çalışır, JS başlatmaz:
 * - msg: grup mesajı / okuma işaretlemesi bildirimi
 * - card: sabit gün kartındaki "kaç kişi okudu" çubuğu ve sayıları
 * - reported: başka cihazdan bildirim yapıldı; o günün hatırlatmaları iptal edilir, kart güncellenir
 * - read: sohbet başka cihazda okundu; mesaj bildirimi kalkar
 */
class PushService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val d = message.data
    try {
      when (d["type"]) {
        "msg" -> InboxPoller.onPush(applicationContext, d)
        "card" -> PushHandlers.card(applicationContext, d)
        "reported" -> PushHandlers.reported(applicationContext, d)
        "read" -> d["groupId"]?.let { InboxPoller.dismiss(applicationContext, it) }
      }
    } catch (_: Throwable) {
      // Hiçbir hata uygulamayı çökertmesin
    }
  }

  /** Cihaz kaydı yenilendi: uygulama açılınca sunucuya yeniden bildirilir */
  override fun onNewToken(token: String) {
    PushHandlers.saveToken(applicationContext, token)
  }
}

object PushHandlers {
  private const val PREFS = "okuma_push"

  fun saveToken(context: Context, token: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("token", token).apply()
  }

  /** Gün kartı ekrandaysa (o gün için) çubuk ve sayıları günceller; sessizce */
  fun card(context: Context, d: Map<String, String>) {
    val p = DayCardRenderer.load(context, d["groupId"] ?: return) ?: return
    if (p.optString("dayKey") != d["dayKey"]) return
    d["seg"]?.let { runCatching { JSONObject(it) }.getOrNull() }?.let { p.put("seg", it) }
    d["done"]?.toIntOrNull()?.let { p.put("done", it) }
    d["total"]?.toIntOrNull()?.let { p.put("total", it) }
    d["kefCount"]?.toIntOrNull()?.let { p.put("kefCount", it) }
    DayCardRenderer.render(context, p, silent = true)
  }

  /** Bildirim başka cihazdan yapıldı / geri alındı */
  fun reported(context: Context, d: Map<String, String>) {
    val groupId = d["groupId"] ?: return
    val dayKey = d["dayKey"] ?: return
    if (d["reported"] == "1") {
      // O günün planlı hatırlatmaları iptal edilir, ekrandakiler kalkar
      val ids = listOf("rem-$groupId-$dayKey", "last-$groupId-$dayKey", "day-$groupId-$dayKey")
      runCatching { NotificationsService.removeScheduledNotifications(context, ids) }
      runCatching { NotificationsService.dismiss(context, ids.toTypedArray()) }
    }
    // Karttaki seçili butonlar: eser başına bildirilen sayfa
    val p = DayCardRenderer.load(context, groupId) ?: return
    if (p.optString("dayKey") != dayKey) return
    val pages = HashMap<String, Int>()
    runCatching { JSONArray(d["books"] ?: "[]") }.getOrNull()?.let { arr ->
      for (i in 0 until arr.length()) arr.optJSONObject(i)?.let { b -> if (!b.isNull("pages")) pages[b.optString("id")] = b.optInt("pages") }
    }
    val books = p.optJSONArray("books") ?: return
    for (i in 0 until books.length()) {
      val b = books.optJSONObject(i) ?: continue
      val id = b.optString("id")
      // Eser kimliği bilinmeyen (tek satırlık) kartta toplam sayfa kullanılır
      val v = if (id.isEmpty()) pages.values.takeIf { it.isNotEmpty() }?.sum() else pages[id]
      if (v != null) b.put("pages", v) else b.put("pages", JSONObject.NULL)
    }
    p.put("kefaretOn", d["kefaretOn"] == "1")
    DayCardRenderer.render(context, p, silent = true)
  }
}
