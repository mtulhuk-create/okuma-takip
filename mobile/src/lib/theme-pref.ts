import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Appearance } from "react-native";

export type ThemePref = "light" | "dark" | "system";
const KEY = "theme-pref";

function apply(p: ThemePref) {
  Appearance.setColorScheme(p === "system" ? "auto" : p);
}

/** Uygulama açılışında kayıtlı tema tercihini uygular */
export async function loadThemePref() {
  const p = ((await SecureStore.getItemAsync(KEY).catch(() => null)) as ThemePref | null) ?? "system";
  apply(p);
  return p;
}

export function useThemePref() {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    loadThemePref().then(setPref);
  }, []);
  return {
    pref,
    setPref: async (p: ThemePref) => {
      setPref(p);
      apply(p);
      await SecureStore.setItemAsync(KEY, p).catch(() => {});
    },
  };
}
