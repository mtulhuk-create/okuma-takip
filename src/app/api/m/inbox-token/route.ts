// Mobil uygulama arka planda yeni mesajları kontrol edebilsin diye kısa kapsamlı imzalı token
import { withUser } from "@/lib/api";
import { signInboxToken } from "@/lib/token";

export const GET = withUser(async (user) => ({ token: await signInboxToken(user.id) }));
