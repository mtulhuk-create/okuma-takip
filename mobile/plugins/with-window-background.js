// Açılış ekranından sonra, uygulama ilk kareyi çizene kadar görünen pencere zemini.
// Ayarlanmazsa Android'in varsayılan koyu gri (#303030) zemini kısa bir an görünüyordu.
// Uygulamanın tema zeminleri kullanılır: açık #faf7f5, koyu #1c1917.
const { AndroidConfig, withAndroidColors, withAndroidColorsNight, withAndroidStyles } = require("expo/config-plugins");

const NAME = "app_window_background";

module.exports = function withWindowBackground(config, { light = "#FAF7F5", dark = "#1C1917" } = {}) {
  config = withAndroidColors(config, (c) => {
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: NAME, value: light });
    return c;
  });
  config = withAndroidColorsNight(config, (c) => {
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: NAME, value: dark });
    return c;
  });
  config = withAndroidStyles(config, (c) => {
    c.modResults = AndroidConfig.Styles.assignStylesValue(c.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: "android:windowBackground",
      value: `@color/${NAME}`,
    });
    return c;
  });
  return config;
};
