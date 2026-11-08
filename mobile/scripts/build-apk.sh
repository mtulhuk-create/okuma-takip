#!/usr/bin/env bash
# Release APK derler. Kullanım: scripts/build-apk.sh [full|lite]
#   full: Okuma Takip (tam sürüm)
#   lite: Okuma Takip Lite (eski telefonlar için; yönetici özellikleri yok, görsel olarak hafif)
# Lite derlemede src/lib/variant.ts ve uygulama adı geçici olarak değiştirilir, sonra geri alınır.
# Çıktı: ../apk/okuma-takip-<sürüm>.apk ya da ../apk/okuma-takip-lite-<sürüm>.apk
set -euo pipefail
cd "$(dirname "$0")/.."
VARIANT="${1:-full}"
STRINGS=android/app/src/main/res/values/strings.xml
TMP="$(mktemp -d)"
cp src/lib/variant.ts "$TMP/variant.ts"
cp "$STRINGS" "$TMP/strings.xml"
restore() {
  cp "$TMP/variant.ts" src/lib/variant.ts
  cp "$TMP/strings.xml" "$STRINGS"
  rm -rf "$TMP"
}
trap restore EXIT

if [ "$VARIANT" = "lite" ]; then
  sed -i 's/^export const LITE = false;/export const LITE = true;/' src/lib/variant.ts
  sed -i 's#<string name="app_name">[^<]*</string>#<string name="app_name">Okuma Takip Lite</string>#' "$STRINGS"
  grep -q "LITE = true" src/lib/variant.ts
fi

# JS paketi her derlemede yeniden üretilsin (sürüm değişince eski paket kullanılmasın)
rm -rf android/app/build/generated/assets/react android/app/build/generated/res/react

(cd android && ./gradlew assembleRelease --no-daemon)

VERSION="$(node -p "require('./app.json').expo.version")"
if [ "$VARIANT" = "lite" ]; then NAME="okuma-takip-lite-$VERSION.apk"; else NAME="okuma-takip-$VERSION.apk"; fi
mkdir -p ../apk
cp android/app/build/outputs/apk/release/app-release.apk "../apk/$NAME"
echo "APK: apk/$NAME"
