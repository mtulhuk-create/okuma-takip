import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KitapKurdu — Okuma Takip",
    short_name: "KitapKurdu",
    description: "Okuma grubu kur, her gün sayfanı bildir.",
    start_url: "/panel",
    display: "standalone",
    background_color: "#faf7f5",
    theme_color: "#9b2c2c",
    lang: "tr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
