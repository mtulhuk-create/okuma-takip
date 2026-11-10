import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { LibreBaskerville_700Bold } from "@expo-google-fonts/libre-baskerville";
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resourceCache } from "@clerk/expo/resource-cache";
import { clearInbox } from "@/lib/inbox";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, useColorScheme, View } from "react-native";
import { installCrashLogger, takeLastCrash } from "@/lib/crash";
import { NotificationBridge } from "@/components/notification-bridge";
import { OfflineSync } from "@/components/offline-sync";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/config";
import { fonts, useColors } from "@/lib/theme";
import { loadThemePref } from "@/lib/theme-pref";
import { DialogHost, showAlert } from "@/lib/dialog";

installCrashLogger();
SplashScreen.preventAutoHideAsync();
loadThemePref();

// İnternetsiz açılışta son veriler görünsün: sorgu önbelleği cihazda 7 gün saklanır
const WEEK = 7 * 86_400_000;
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, gcTime: WEEK } },
});
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "okuma-takip-cache", throttleTime: 3000 });

/**
 * Cihazda saklanacak sorgular: internetsiz açılışta gereken ekranlar (Bugün, gruplar, sohbet, kaza, profil).
 * Yönetim, kefaret önizlemesi, uzun geçmiş aralıkları ve aramalar saklanmaz: önbellek küçük kalır,
 * açılışta okunup çözümlenmesi eski telefonlarda hızlanır; bu ekranlar açıldığında zaten yeniden yüklenir.
 */
function shouldPersist(q: { queryKey: readonly unknown[]; state: { status: string } }) {
  if (q.state.status !== "success") return false;
  const [key, arg] = q.queryKey;
  if (typeof key !== "string") return false;
  if (key === "user-search" || key.endsWith("/admin") || key.includes("/kefaret") || key.includes("/book-matches")) return false;
  // Geçmiş: yalnızca varsayılan 7 günlük görünüm
  if (key.endsWith("/history")) return arg === undefined || arg === "7d";
  return true;
}

/** Ekran çizilirken hata olursa uygulama kapanmaz: hata mesajı ve "Tekrar dene" gösterilir */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const text = `${error.message}\n\n${(error.stack ?? "").slice(0, 800)}`;
  return (
    <View style={{ flex: 1, backgroundColor: "#faf7f5", padding: 24, paddingTop: 64, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#1c1917" }}>Bir hata oluştu</Text>
      <Text style={{ fontSize: 14, color: "#57534e" }}>Bu ekranın görüntüsünü paylaşırsan sorunu hızlıca çözebiliriz.</Text>
      <ScrollView style={{ maxHeight: 280, backgroundColor: "#fff", borderRadius: 10, padding: 10 }}>
        <Text selectable style={{ fontSize: 12, color: "#9b2c2c" }}>
          {text}
        </Text>
      </ScrollView>
      <Pressable onPress={retry} style={{ backgroundColor: "#9b2c2c", borderRadius: 10, padding: 12, alignItems: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "600" }}>Tekrar dene</Text>
      </Pressable>
      <Pressable onPress={() => Clipboard.setStringAsync(text)} style={{ borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#d6d3d1" }}>
        <Text style={{ color: "#1c1917", fontWeight: "600" }}>Hatayı kopyala</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, LibreBaskerville_700Bold });
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache} __experimental_resourceCache={resourceCache}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: WEEK, buster: "1", dehydrateOptions: { shouldDehydrateQuery: shouldPersist } }}>
        {fontsLoaded && <Navigation />}
        {fontsLoaded && <DialogHost />}
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
  // Uygulama önceki açılışta bir hatayla kapandıysa sebebini göster
  useEffect(() => {
    takeLastCrash().then((crash) => {
      if (!crash) return;
      const text = `${crash.msg}\n\n${crash.stack.slice(0, 1500)}`;
      showAlert("Uygulama son kullanımda hata verdi", `${text}\n\nBu mesajın ekran görüntüsünü paylaşırsan sorunu çözebiliriz.`, [
        { text: "Kopyala", onPress: () => Clipboard.setStringAsync(text) },
        { text: "Tamam" },
      ]);
    });
  }, []);
  // Yalnızca gerçekten çıkış yapıldığında önbelleği temizle (Clerk yüklenmeden önce değil; internetsiz açılışta veriler kalsın)
  useEffect(() => {
    if (isLoaded && isSignedIn === false) {
      queryClient.clear();
      clearInbox();
    }
  }, [isLoaded, isSignedIn]);
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
        {/* Google ile giriş dönüşü: oturum açılınca ana sayfaya geçer */}
        <Stack.Screen name="sso-callback" options={{ headerShown: false, animation: "none" }} />
      </Stack>
    </ThemeProvider>
  );
}
