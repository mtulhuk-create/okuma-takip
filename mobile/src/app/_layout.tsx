import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { LibreBaskerville_700Bold } from "@expo-google-fonts/libre-baskerville";
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resourceCache } from "@clerk/expo/resource-cache";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { NotificationBridge } from "@/components/notification-bridge";
import { OfflineSync } from "@/components/offline-sync";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/config";
import { fonts, useColors } from "@/lib/theme";
import { loadThemePref } from "@/lib/theme-pref";

SplashScreen.preventAutoHideAsync();
loadThemePref();

// İnternetsiz açılışta son veriler görünsün: sorgu önbelleği cihazda 7 gün saklanır
const WEEK = 7 * 86_400_000;
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, gcTime: WEEK } },
});
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "okuma-takip-cache" });

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, LibreBaskerville_700Bold });
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache} __experimental_resourceCache={resourceCache}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: WEEK, buster: "1" }}>
        {fontsLoaded && <Navigation />}
      </PersistQueryClientProvider>
    </ClerkProvider>
  );
}

function Navigation() {
  const scheme = useColorScheme();
  const c = useColors();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded) SplashScreen.hideAsync();
  }, [isLoaded]);
  useEffect(() => {
    if (!isSignedIn) queryClient.clear();
  }, [isSignedIn]);
  if (!isLoaded) return null;

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: c.primary, background: c.background, card: c.card, text: c.foreground, border: c.border } };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {isSignedIn && <NotificationBridge />}
      {isSignedIn && <OfflineSync />}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.background },
          headerTitleStyle: { fontFamily: fonts.semibold, color: c.foreground },
          headerTintColor: c.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Protected guard={!!isSignedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="group/new" options={{ title: "Yeni okuma grubu", presentation: "modal" }} />
          <Stack.Screen name="group/[id]/index" options={{ title: "" }} />
          <Stack.Screen name="group/[id]/info" options={{ title: "Grup bilgisi" }} />
          <Stack.Screen name="group/[id]/admin" options={{ title: "Grup yönetimi" }} />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
