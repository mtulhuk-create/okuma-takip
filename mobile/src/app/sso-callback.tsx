import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Loading } from "@/components/ui";

/**
 * Google ile giriş/kayıt dönüş adresi (okumatakip:///sso-callback). Clerk oturumu uygulama içinde tamamlar;
 * bu ekran yalnızca oturum açılınca ana sayfaya geçirir. Yoksa "Unmatched Route" hatası görünüyordu.
 */
export default function SsoCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);
  if (isLoaded && isSignedIn) return <Redirect href="/" />;
  // Oturum açılamadıysa (iptal ya da hata) giriş ekranına dön
  if (timedOut) return <Redirect href="/sign-in" />;
  return <Loading />;
}
