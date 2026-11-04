// Release APK'yı depo dışında tutulan anahtarla imzalar.
// Anahtar bilgileri: KEYSTORE_PROPERTIES ortam değişkeni ya da ~/android-build/okuma-takip-keystore.properties
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// okuma-takip: release signing";

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARKER)) return cfg;
    src = src.replace(
      /android\s*\{/,
      `${MARKER}
def okumaKeystoreFile = file(System.getenv("KEYSTORE_PROPERTIES") ?: "\${System.getProperty('user.home')}/android-build/okuma-takip-keystore.properties")
def okumaKeystore = new Properties()
if (okumaKeystoreFile.exists()) okumaKeystoreFile.withInputStream { okumaKeystore.load(it) }

android {`,
    );
    src = src.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        release {
            if (okumaKeystore['storeFile']) {
                storeFile file(okumaKeystore['storeFile'])
                storePassword okumaKeystore['storePassword']
                keyAlias okumaKeystore['keyAlias']
                keyPassword okumaKeystore['keyPassword']
            }
        }`,
    );
    src = src.replace(
      /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig okumaKeystore['storeFile'] ? signingConfigs.release : signingConfigs.debug",
    );
    cfg.modResults.contents = src;
    return cfg;
  });
};
