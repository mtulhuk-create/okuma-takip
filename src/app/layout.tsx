import { ClerkProvider } from "@clerk/nextjs";
import { trTR } from "@clerk/localizations";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Libre_Baskerville, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-poppins" });
const baskerville = Libre_Baskerville({ subsets: ["latin", "latin-ext"], weight: ["400", "700"], variable: "--font-libre-baskerville" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "600"], variable: "--font-ibm-plex-mono" });

// Sistem karanlık moduna göre .dark sınıfını ayarlar (tema .dark sınıfıyla çalışır)
const themeScript = `(function(){var m=window.matchMedia("(prefers-color-scheme: dark)");function a(){document.documentElement.classList.toggle("dark",m.matches)}a();m.addEventListener("change",a)})()`;

export const metadata: Metadata = {
  title: { default: "KitapKurdu — Okuma Takip", template: "%s · KitapKurdu" },
  description: "Arkadaşlarınla okuma grubu kur, her gün sayfanı bildir, okumayana ceza!",
  appleWebApp: { capable: true, title: "KitapKurdu", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${poppins.variable} ${baskerville.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <ClerkProvider
          localization={trTR}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/panel"
          signUpFallbackRedirectUrl="/panel"
          appearance={{ variables: { colorPrimary: "#9b2c2c", borderRadius: "0.375rem", fontFamily: "var(--font-poppins), Poppins, sans-serif" } }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
