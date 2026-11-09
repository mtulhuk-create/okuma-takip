// Uygulama içinden seçilebilen uygulama simgesi (Android): her simge için bir başlatıcı takma adı (activity-alias).
// MainActivity'deki MAIN/LAUNCHER kaldırılır; "Açık" (varsayılan) ve "Koyu" takma adları eklenir.
// Seçim, takma adlardan biri etkinleştirilip diğeri kapatılarak yapılır (DayCardNotification.setAppIcon).
const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidColors, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const ICONS = [
  { key: "light", alias: ".IconLight", icon: "@mipmap/ic_launcher", round: "@mipmap/ic_launcher_round", enabled: true },
  { key: "dark", alias: ".IconDark", icon: "@mipmap/ic_launcher_dark", round: "@mipmap/ic_launcher_dark_round", enabled: false },
];

function withIconFiles(config) {
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const res = path.join(c.modRequest.platformProjectRoot, "app", "src", "main", "res");
      const src = path.join(c.modRequest.projectRoot, "assets", "app-icons", "dark");
      for (const dir of fs.readdirSync(src)) {
        fs.mkdirSync(path.join(res, dir), { recursive: true });
        for (const f of fs.readdirSync(path.join(src, dir))) fs.copyFileSync(path.join(src, dir, f), path.join(res, dir, f));
      }
      const anydpi = path.join(res, "mipmap-anydpi-v26");
      fs.mkdirSync(anydpi, { recursive: true });
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackgroundDark"/>
    <foreground android:drawable="@mipmap/ic_launcher_dark_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
      fs.writeFileSync(path.join(anydpi, "ic_launcher_dark.xml"), xml);
      fs.writeFileSync(path.join(anydpi, "ic_launcher_dark_round.xml"), xml);
      return c;
    },
  ]);
}

function withIconColor(config) {
  return withAndroidColors(config, (c) => {
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: "iconBackgroundDark", value: "#1C1917" });
    return c;
  });
}

function withAliases(config) {
  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    const main = (app.activity ?? []).find((a) => a.$["android:name"] === ".MainActivity");
    if (!main) return c;
    const isLauncher = (f) => (f.action ?? []).some((a) => a.$["android:name"] === "android.intent.action.MAIN") && (f.category ?? []).some((x) => x.$["android:name"] === "android.intent.category.LAUNCHER");
    main["intent-filter"] = (main["intent-filter"] ?? []).filter((f) => !isLauncher(f));
    app["activity-alias"] = (app["activity-alias"] ?? []).filter((a) => !ICONS.some((i) => i.alias === a.$["android:name"]));
    for (const i of ICONS) {
      app["activity-alias"].push({
        $: {
          "android:name": i.alias,
          "android:enabled": String(i.enabled),
          "android:exported": "true",
          "android:icon": i.icon,
          "android:roundIcon": i.round,
          "android:targetActivity": ".MainActivity",
        },
        "intent-filter": [{ action: [{ $: { "android:name": "android.intent.action.MAIN" } }], category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }] }],
      });
    }
    return c;
  });
}

module.exports = function withAppIcons(config) {
  return withAliases(withIconColor(withIconFiles(config)));
};
