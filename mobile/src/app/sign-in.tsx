import { useSignIn, useSignUp } from "@clerk/expo";
import { useSSO } from "@clerk/expo/experimental";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Button, H1, Input, Muted, Row, Segmented } from "@/components/ui";
import { fonts, useColors } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

/** Clerk hatalarını Türkçe, anlaşılır bir mesaja çevirir. */
function errorText(error: unknown) {
  const e = error as { errors?: { code?: string; longMessage?: string; message?: string }[]; code?: string; longMessage?: string; message?: string } | null;
  const first = e?.errors?.[0] ?? e;
  const code = first?.code ?? "";
  const TR: Record<string, string> = {
    form_password_incorrect: "Şifre yanlış.",
    form_identifier_not_found: "Bu e-posta ile kayıtlı hesap yok. Önce kayıt ol.",
    form_identifier_exists: "Bu e-posta zaten kayıtlı. Giriş yap sekmesinden devam et.",
    form_password_pwned: "Bu şifre güvenli değil (sızdırılmış şifreler listesinde). Başka bir şifre seç.",
    form_password_length_too_short: "Şifre en az 8 karakter olmalı.",
    form_password_validation_failed: "Şifre yanlış.",
    form_param_format_invalid: "E-posta adresini kontrol et.",
    form_param_nil: "Tüm alanları doldur.",
    form_code_incorrect: "Kod yanlış.",
    verification_expired: "Kodun süresi doldu, yeniden gönder.",
    verification_failed: "Doğrulama başarısız, kodu yeniden gönder.",
    too_many_requests: "Çok fazla deneme yapıldı, biraz bekle.",
    session_exists: "Zaten giriş yapılmış.",
  };
  return TR[code] ?? first?.longMessage ?? first?.message ?? "Bir hata oluştu, tekrar dene.";
}

type Step = "form" | "signUpCode" | "signInCode";

export default function SignInScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [mode, setMode] = useState<"in" | "up">("up");
  const [step, setStep] = useState<Step>("form");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  // ---- Giriş: e-posta + şifre; yeni cihazda e-postaya gelen kodla doğrulama
  const doSignIn = () =>
    run("signin", async () => {
      const r = await signIn.password({ identifier: email.trim(), password });
      if (r.error) throw r.error;
      if (signIn.status === "complete") {
        const f = await signIn.finalize();
        if (f.error) throw f.error;
        return;
      }
      if (signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor") {
        const s = await signIn.mfa.sendEmailCode();
        if (s.error) throw s.error;
        setCode("");
        setStep("signInCode");
        return;
      }
      throw new Error("Giriş tamamlanamadı, tekrar dene.");
    });

  const verifySignIn = () =>
    run("verify", async () => {
      const r = await signIn.mfa.verifyEmailCode({ code: code.trim() });
      if (r.error) throw r.error;
      if (signIn.status !== "complete") throw new Error("Kod doğrulanamadı.");
      const f = await signIn.finalize();
      if (f.error) throw f.error;
    });

  // ---- Kayıt: ad, soyad, e-posta, şifre → e-postaya gelen kod
  const doSignUp = () =>
    run("signup", async () => {
      if (first.trim().length < 2 || last.trim().length < 2) throw new Error("Ad ve soyadını yaz.");
      const r = await signUp.password({ emailAddress: email.trim(), password, firstName: first.trim(), lastName: last.trim(), locale: "tr-TR" });
      if (r.error) throw r.error;
      if (signUp.status === "complete") {
        const f = await signUp.finalize();
        if (f.error) throw f.error;
        return;
      }
      const s = await signUp.verifications.sendEmailCode();
      if (s.error) throw s.error;
      setCode("");
      setStep("signUpCode");
    });

  const verifySignUp = () =>
    run("verify", async () => {
      const r = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (r.error) throw r.error;
      if (signUp.status !== "complete") throw new Error("Kayıt tamamlanamadı, bilgileri kontrol et.");
      const f = await signUp.finalize();
      if (f.error) throw f.error;
    });

  const resend = () =>
    run("resend", async () => {
      const r = step === "signUpCode" ? await signUp.verifications.sendEmailCode() : await signIn.mfa.sendEmailCode();
      if (r.error) throw r.error;
    });

  // ---- Google: yalnızca Google'ın giriş sayfası açılır, sonra doğrudan uygulamaya döner
  const google = () =>
    run("google", async () => {
      await startSSOFlow({ strategy: "oauth_google" });
    });

  const validEmail = /\S+@\S+\.\S+/.test(email.trim());
  const canSubmit = validEmail && password.length >= 8 && (mode === "in" || (first.trim().length >= 2 && last.trim().length >= 2));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24, gap: 18, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", gap: 8 }}>
          <Image source={require("@/assets/images/icon.png")} style={{ width: 84, height: 84, borderRadius: 22 }} />
          <H1 style={{ fontSize: 28 }}>Okuma Takip</H1>
          <Body style={{ textAlign: "center", color: c.mutedForeground }}>Arkadaşlarınla okuma grubu kur, her gün sayfanı bildir.</Body>
        </View>

        {step === "form" ? (
          <View style={{ gap: 12 }}>
            <Segmented
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              options={[
                { value: "up", label: "Kayıt ol" },
                { value: "in", label: "Giriş yap" },
              ]}
            />
            {mode === "up" && (
              <Row gap={10}>
                <View style={{ flex: 1 }}>
                  <Input label="Ad" value={first} onChangeText={setFirst} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" maxLength={40} />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Soyad" value={last} onChangeText={setLast} autoCapitalize="words" autoComplete="family-name" textContentType="familyName" maxLength={40} />
                </View>
              </Row>
            )}
            <Input label="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
            <Input
              label="Şifre"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              textContentType={mode === "up" ? "newPassword" : "password"}
              placeholder={mode === "up" ? "En az 8 karakter" : undefined}
            />
            {error && <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.destructive }}>{error}</Text>}
            <Button
              title={mode === "up" ? "Kayıt ol" : "Giriş yap"}
              onPress={mode === "up" ? doSignUp : doSignIn}
              loading={busy === "signin" || busy === "signup"}
              disabled={!canSubmit || !!busy}
            />
            <Row gap={10} style={{ marginVertical: 2 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              <Muted>ya da</Muted>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            </Row>
            <Button title="Google ile devam et" variant="ghost" onPress={google} loading={busy === "google"} disabled={!!busy} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Body style={{ textAlign: "center" }}>
              <Text style={{ fontFamily: fonts.semibold }}>{email.trim()}</Text> adresine 6 haneli bir kod gönderdik.
            </Body>
            <Input label="Doğrulama kodu" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus style={{ textAlign: "center", fontSize: 22, letterSpacing: 8 }} />
            {error && <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.destructive }}>{error}</Text>}
            <Button title="Doğrula" onPress={step === "signUpCode" ? verifySignUp : verifySignIn} loading={busy === "verify"} disabled={code.length < 6 || !!busy} />
            <Row style={{ justifyContent: "space-between" }}>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setStep("form");
                  setError(null);
                }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.mutedForeground }}>Geri dön</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={resend} disabled={!!busy}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.primary }}>{busy === "resend" ? "Gönderiliyor…" : "Kodu yeniden gönder"}</Text>
              </Pressable>
            </Row>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
