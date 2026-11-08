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
    private val LABEL = mapOf("kefaret" to "Kefaret okuması", "all" to "Okudum", "min" to "Alt sınır", "none" to "Okumadım")
  }

  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra("id") ?: return
    val choice = intent.getStringExtra("choice") ?: return
    val p = DayCardRenderer.load(context, id) ?: return
    val pending = goAsync()
    DayCardRenderer.render(context, p, "Gönderiliyor…", silent = true)
    Thread {
      try {
        val (ok, message) = post(p.optString("apiUrl"), p.optString("token"), choice)
        if (ok) p.put("myState", choice)
        DayCardRenderer.render(context, p, if (ok) "${LABEL[choice] ?: "Bildirim"} kaydedildi ✓" else message, silent = true)
      } catch (_: Throwable) {
        DayCardRenderer.render(context, p, "Gönderilemedi: internet yok", silent = true)
      } finally {
        pending.finish()
      }
    }.start()
  }

  private fun post(apiUrl: String, token: String, choice: String): Pair<Boolean, String> {
    val conn = URL("${apiUrl.trimEnd('/')}/api/quick-report").openConnection() as HttpURLConnection
    return try {
      conn.requestMethod = "POST"
      conn.connectTimeout = 10_000
      conn.readTimeout = 10_000
      conn.doOutput = true
      conn.setRequestProperty("content-type", "application/json")
      conn.setRequestProperty("x-app-variant", "full")
      val body = JSONObject().put("token", token).put("choice", choice).toString()
      conn.outputStream.use { it.write(body.toByteArray()) }
      val code = conn.responseCode
      val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
      if (code in 200..299) true to "" else false to (runCatching { JSONObject(text).optString("error") }.getOrNull()?.takeIf { it.isNotEmpty() } ?: "Bildirilemedi")
    } finally {
      conn.disconnect()
    }
  }
}
