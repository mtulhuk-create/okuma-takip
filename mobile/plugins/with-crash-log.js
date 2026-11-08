// Yerel (Java/Kotlin) çökmeleri yakalar: yığın izini uygulamanın AsyncStorage veritabanına yazar,
// bir sonraki açılışta JS tarafı gösterir (src/lib/crash.ts). Sonra varsayılan işleyici çağrılır.
const { withMainApplication } = require("expo/config-plugins");

const MARKER = "// okuma-takip: crash log";
const HANDLER = `
    ${MARKER}
    val okumaPrevHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        val sw = java.io.StringWriter()
        error.printStackTrace(java.io.PrintWriter(sw))
        val json = org.json.JSONObject()
          .put("at", System.currentTimeMillis())
          .put("thread", thread.name)
          .put("stack", sw.toString().take(4000))
          .toString()
        val db = android.database.sqlite.SQLiteDatabase.openOrCreateDatabase(getDatabasePath("RKStorage"), null)
        db.execSQL("CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        db.execSQL("INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES (?, ?)", arrayOf<Any>("native-crash", json))
        db.close()
      } catch (_: Throwable) {}
      okumaPrevHandler?.uncaughtException(thread, error)
    }
`;

function apply(src) {
  if (src.includes(MARKER)) return src;
  return src.replace(/super\.onCreate\(\)\n/, (m) => m + HANDLER);
}

module.exports = function withCrashLog(config) {
  return withMainApplication(config, (cfg) => {
    cfg.modResults.contents = apply(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.apply = apply;
