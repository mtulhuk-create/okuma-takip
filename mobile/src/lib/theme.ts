import { useColorScheme } from "react-native";

// Web temasıyla (globals.css) aynı renkler
const light = {
  background: "#faf7f5",
  foreground: "#1a1a1a",
  card: "#ffffff",
  primary: "#9b2c2c",
  primaryForeground: "#ffffff",
  secondary: "#fdf2d6",
  secondaryForeground: "#805500",
  muted: "#f0ebe8",
  mutedForeground: "#57534e",
  accent: "#fef3c7",
  accentForeground: "#7f1d1d",
  destructive: "#991b1b",
  border: "#f5e8d2",
  success: "#047857",
  successBg: "#d1fae5",
  warning: "#b45309",
  warningBg: "#fef3c7",
  dangerBg: "#fee2e2",
  info: "#0369a1",
  infoBg: "#e0f2fe",
};

const dark: typeof light = {
  background: "#1c1917",
  foreground: "#f5f5f4",
  card: "#292524",
  primary: "#b91c1c",
  primaryForeground: "#faf7f5",
  secondary: "#82181a",
  secondaryForeground: "#fef3c7",
  muted: "#1f1c1a",
  mutedForeground: "#d6d3d1",
  accent: "#b45309",
  accentForeground: "#fef3c7",
  destructive: "#ef4444",
  border: "#44403c",
  success: "#34d399",
  successBg: "#064e3b",
  warning: "#fbbf24",
  warningBg: "#451a03",
  dangerBg: "#450a0a",
  info: "#7dd3fc",
  infoBg: "#082f49",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
  serif: "LibreBaskerville_700Bold",
};

export const radius = 6; // --radius: 0.375rem
