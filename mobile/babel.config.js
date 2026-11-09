module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Simgeler tek tek: paket boyutu ve açılış süresi (eski telefonlar)
    plugins: ["./plugins/babel-lucide-icons"],
  };
};
