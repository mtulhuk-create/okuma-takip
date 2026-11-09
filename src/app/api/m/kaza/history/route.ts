// Kaza geçmişi: aralıktaki günlük kılınan kaza (Bugün sayfasındaki geçmiş kutusu)
import { withUser } from "@/lib/api";
import { parseRange } from "@/lib/history";
import { kazaHistory } from "@/lib/kaza";

export const GET = withUser(async (user, req) => kazaHistory(user.id, parseRange(new URL(req.url).searchParams.get("range"))));
