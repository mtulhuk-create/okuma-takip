package expo.modules.daycard

import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.util.LruCache
import androidx.core.graphics.PathParser
import androidx.core.graphics.drawable.IconCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Bildirimde yazanın avatarı (uygulamadaki gibi): profil fotoğrafı varsa o, yoksa kişiye özel renkte baş harf.
 * Grup ayarlarında açıksa ekip çerçevesi (halka + çıkıntılar) ve seri (alev içinde gün sayısı) da çizilir.
 */
object AvatarIcon {
  private const val SIZE = 144
  private val photos = LruCache<String, Bitmap>(24)

  // Uygulamadaki sistem avatarı renkleri (açık / koyu tema): [arka plan, yazı]
  private val LIGHT = arrayOf(
    "#ffe4e6" to "#9f1239", "#fef3c7" to "#92400e", "#d1fae5" to "#065f46", "#e0f2fe" to "#075985", "#ede9fe" to "#5b21b6",
    "#ffedd5" to "#9a3412", "#ccfbf1" to "#115e59", "#fae8ff" to "#86198f", "#ecfccb" to "#3f6212", "#e0e7ff" to "#3730a3",
  )
  private val DARK = arrayOf(
    "#881337" to "#ffe4e6", "#78350f" to "#fef3c7", "#064e3b" to "#d1fae5", "#0c4a6e" to "#e0f2fe", "#4c1d95" to "#ede9fe",
    "#7c2d12" to "#ffedd5", "#134e4a" to "#ccfbf1", "#701a75" to "#fae8ff", "#365314" to "#ecfccb", "#312e81" to "#e0e7ff",
  )
  private val TIER = mapOf("gold" to "#D4A017", "silver" to "#A7B1BC", "bronze" to "#B07040")
  // Altın 4 çıkıntı, gümüş üst + alt, bronz üst
  private val NOTCHES = mapOf("gold" to listOf(0, 1, 2, 3), "silver" to listOf(0, 2), "bronze" to listOf(0))
  // Lucide "flame" simgesi (24'lük görünüm)
  private const val FLAME = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"

  /** Mesajdaki alanlardan simge; hiçbir şey çizilemezse null (sistem kendi simgesini kullanır) */
  fun make(context: Context, m: JSONObject): IconCompat? = runCatching {
    val name = m.optString("author")
    val seed = m.optString("authorId").ifEmpty { name }
    if (seed.isEmpty()) return null
    val bmp = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val tier = m.optString("tier")
    val framed = TIER.containsKey(tier)
    // Çerçeve ve alev için kenarda pay bırakılır
    val pad = SIZE * 0.1f
    val r = SIZE / 2f - pad
    val cx = SIZE / 2f
    val cy = SIZE / 2f
    val photo = m.optString("avatar").takeIf { it.startsWith("https://") }?.let { photo(it) }
    if (photo != null) {
      val shader = BitmapShader(photo, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
      val scale = (2 * r) / minOf(photo.width, photo.height)
      shader.setLocalMatrix(Matrix().apply {
        setScale(scale, scale)
        postTranslate(cx - photo.width * scale / 2, cy - photo.height * scale / 2)
      })
      c.drawCircle(cx, cy, r, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.shader = shader })
    } else {
      // Uygulamadaki gibi: kişiye özel renk ve baş harf
      var h = 0L
      for (ch in seed) h = (h * 31 + ch.code) and 0xffffffffL
      val dark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
      val (bg, fg) = (if (dark) DARK else LIGHT)[(h % LIGHT.size).toInt()]
      c.drawCircle(cx, cy, r, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor(bg) })
      val letter = m.optString("initial").ifEmpty { name.firstOrNull { it.isLetterOrDigit() }?.toString() ?: "?" }.uppercase(java.util.Locale.forLanguageTag("tr"))
      val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor(fg)
        textSize = r * 0.95f
        typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
        textAlign = Paint.Align.CENTER
      }
      c.drawText(letter, cx, cy - (text.descent() + text.ascent()) / 2, text)
    }
    if (framed) {
      val color = Color.parseColor(TIER[tier])
      val ring = SIZE * 0.025f
      c.drawCircle(cx, cy, r + ring / 2, Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = ring; this.color = color })
      // Çıkıntılar: halkanın üzerinde küçük baklava (üst, sağ, alt, sol)
      val d = SIZE * 0.07f
      val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
      val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = SIZE * 0.008f; this.color = Color.WHITE }
      for (side in NOTCHES[tier].orEmpty()) {
        val angle = Math.toRadians(-90.0 + side * 90.0)
        val x = cx + (r + ring / 2) * Math.cos(angle).toFloat()
        val y = cy + (r + ring / 2) * Math.sin(angle).toFloat()
        c.save()
        c.rotate(45f, x, y)
        c.drawRect(x - d / 2, y - d / 2, x + d / 2, y + d / 2, fill)
        c.drawRect(x - d / 2, y - d / 2, x + d / 2, y + d / 2, edge)
        c.restore()
      }
    }
    val streak = m.optString("streak").toIntOrNull()
    if (streak != null && streak >= 3) {
      // Seri: sağ üst köşede alev, içinde gün sayısı (tam seri yeşil)
      val color = if (m.optString("streakFull") == "1") Color.parseColor("#10b981") else Color.parseColor("#f97316")
      val fs = SIZE * 0.46f
      val path = PathParser.createPathFromPathData(FLAME)
      val left = SIZE - fs
      c.save()
      c.translate(left, 0f)
      c.scale(fs / 24f, fs / 24f)
      c.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; style = Paint.Style.FILL })
      c.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.WHITE; style = Paint.Style.STROKE; strokeWidth = 1.2f })
      c.restore()
      val num = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = Color.WHITE
        textSize = fs * (if (streak >= 100) 0.28f else 0.36f)
        typeface = Typeface.DEFAULT_BOLD
        textAlign = Paint.Align.CENTER
      }
      c.drawText(streak.toString(), left + fs / 2, fs * 0.66f - (num.descent() + num.ascent()) / 2 - fs * 0.05f, num)
    }
    IconCompat.createWithBitmap(bmp)
  }.getOrNull()

  /** Profil fotoğrafı (bildirim arka planda; bellekte saklanır, aynı kişi için tekrar indirilmez) */
  private fun photo(url: String): Bitmap? {
    photos.get(url)?.let { return it }
    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
      connectTimeout = 5_000
      readTimeout = 5_000
    }
    return try {
      if (conn.responseCode != 200) return null
      val raw = conn.inputStream.use { BitmapFactory.decodeStream(it) } ?: return null
      val small = Bitmap.createScaledBitmap(raw, SIZE, (SIZE * raw.height.toFloat() / raw.width).toInt().coerceAtLeast(1), true)
      photos.put(url, small)
      small
    } catch (_: Throwable) {
      null
    } finally {
      conn.disconnect()
    }
  }
}
