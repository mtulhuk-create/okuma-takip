import type { CapacitorConfig } from "@capacitor/cli";

// APK, yayındaki web uygulamasını açar; böylece web ve mobil her zaman aynı sürümdür.
// Adres değişirse: CAP_SERVER_URL=https://... npm run cap:sync
const serverUrl = process.env.CAP_SERVER_URL || "https://okuma-takip.workers.dev";

const config: CapacitorConfig = {
  appId: "com.okumatakip.app",
  appName: "Okuma Takip",
  webDir: "mobile-shell",
  server: {
    url: serverUrl,
    androidScheme: "https",
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_book",
      iconColor: "#9b2c2c",
    },
  },
};

export default config;
