// app.json'a ek: Firebase ayar dosyası (google-services.json) bu klasöre konduysa Android derlemesine bağlanır.
// Dosya yoksa uygulama Firebase'siz derlenir (anlık bildirim kapalı, aralıklı kontrol çalışır).
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, "google-services.json"))) {
    config.android = { ...config.android, googleServicesFile: "./google-services.json" };
  }
  return config;
};
