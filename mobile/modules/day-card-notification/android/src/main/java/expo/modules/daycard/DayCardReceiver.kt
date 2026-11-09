package expo.modules.daycard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Kilit ekranı kartındaki butonlar: okuma JS açılmadan doğrudan sunucuya bildirilir
 * (eski telefonlarda uygulamayı arka planda başlatmak yavaş). Sonuç kartın üzerinde görünür.
 */
class DayCardReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION = "expo.modules.daycard.ACTION"
    private val LABEL = mapOf("kefaret" to "Kefaret okuması", "read" to "Okudum", "min" to "Alt sınır", "none" to "Okumadım")
  }

  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra("id") ?: return
    val choice = intent.getStringExtra("choice") ?: return
    val bookId = intent.getStringExtra("bookId")
    val bookChoice = intent.getStringExtra("bookChoice")
    val p = DayCardRenderer.load(context, id) ?: return
    val pending = goAsync()
    // Basılan buton hemen seçili görünsün; sunucu yanıtı gelince kesinleşir, hata olursa eski hâline döner
    val before = JSONObject(p.toString())
    optimistic(p, choice, bookId, bookChoice)
    DayCardRenderer.render(context, p, "Gönderiliyor…", silent = true)
    Thread {
      try {
        val (ok, res) = post(p.optString("apiUrl"), p.optString("token"), choice, bookId, bookChoice)
        if (ok && res != null) apply(p, res)
        val label = LABEL[bookChoice ?: choice] ?: "Bildirim"
        val undone = ok && res?.optInt("pages", -1) == 0 && (res.optJSONArray("books")?.length() ?: 0) == 0
        if (ok) DayCardRenderer.render(context, p, if (undone) "Geri alındı · beklemede" else "$label kaydedildi ✓", silent = true)
        else DayCardRenderer.render(context, before, res?.optString("error")?.takeIf { it.isNotEmpty() } ?: "Bildirilemedi", silent = true)
      } catch (_: Throwable) {
        DayCardRenderer.render(context, before, "Gönderilemedi: internet yok", silent = true)
      } finally {
        pending.finish()
      }
    }.start()
  }

  /** Sunucudaki kuralın aynısı: aynı seçime tekrar basmak geri alır */
  private fun optimistic(p: JSONObject, choice: String, bookId: String?, bookChoice: String?) {
    val books = p.optJSONArray("books") ?: return
    if (choice == "kefaret" && bookId == null) {
      val on = !p.optBoolean("kefaretOn")
      p.put("kefaretOn", on)
      for (i in 0 until books.length()) {
        val b = books.getJSONObject(i)
        b.put("pages", if (on) (if (b.has("kefPages")) b.optInt("kefPages") else b.optInt("target")) else JSONObject.NULL)
      }
      return
    }
    if (bookId == null || bookChoice == null) return
    p.put("kefaretOn", false)
    for (i in 0 until books.length()) {
      val b = books.getJSONObject(i)
      if (b.getString("id") != bookId) continue
      val next = when (bookChoice) {
        "read" -> b.optInt("target")
        "min" -> b.optInt("min")
        else -> 0
      }
      val cur = if (b.isNull("pages")) null else b.optInt("pages")
      b.put("pages", if (cur == next) JSONObject.NULL else next)
    }
  }

  /** Sunucunun döndürdüğü eser sayfalarını ve kefareti karta işler */
  private fun apply(p: JSONObject, res: JSONObject) {
    val pages = mutableMapOf<String, Int?>()
    res.optJSONArray("books")?.let { arr ->
      for (i in 0 until arr.length()) {
        val b = arr.getJSONObject(i)
        pages[b.getString("id")] = if (b.isNull("pages")) null else b.optInt("pages")
      }
    }
    p.optJSONArray("books")?.let { arr ->
      for (i in 0 until arr.length()) {
        val b = arr.getJSONObject(i)
        b.put("pages", pages[b.getString("id")] ?: JSONObject.NULL)
      }
    }
    p.put("kefaretOn", res.optInt("kefaret") > 0)
  }

  private fun post(apiUrl: String, token: String, choice: String, bookId: String?, bookChoice: String?): Pair<Boolean, JSONObject?> {
    val conn = URL("${apiUrl.trimEnd('/')}/api/quick-report").openConnection() as HttpURLConnection
    return try {
      conn.requestMethod = "POST"
      conn.connectTimeout = 10_000
      conn.readTimeout = 10_000
      conn.doOutput = true
      conn.setRequestProperty("content-type", "application/json")
      conn.setRequestProperty("x-app-variant", "full")
      // toggle: uygulamadaki gibi aynı butona tekrar basınca geri alınır
      val body = JSONObject().put("token", token).put("choice", choice).put("toggle", true).apply {
        if (bookId != null && bookChoice != null) put("bookId", bookId).put("bookChoice", bookChoice)
      }.toString()
      conn.outputStream.use { it.write(body.toByteArray()) }
      val code = conn.responseCode
      val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
      val json = runCatching { JSONObject(text) }.getOrNull()
      (code in 200..299) to json
    } finally {
      conn.disconnect()
    }
  }
}
