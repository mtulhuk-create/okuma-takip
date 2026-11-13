// Kefaret okuması: yönetici cezalara indirimi okuma karşılığı verir.
//
// Adalet formülü
// --------------
// Her üyenin ödenmemiş cezası C (TL) ve bu cezaların yazıldığı günlerde eksik kalan sayfa M vardır.
// 1) Grup genelinde ortak bir "sayfa değeri" bulunur:  v = ΣM / ΣC   (1 TL ceza kaç eksik sayfaya karşılık geliyor)
//    Böylece hangi ekipte olursa olsun, aynı TL indirim herkes için aynı sayıda kefaret sayfası demektir;
//    çok sayfa okuyan ekip, aynı indirim için diğerlerinden fazla sayfa okumaz.
// 2) Kişinin kazanabileceği indirim:           D = C × indirim%
// 3) Gereken kefaret sayfası:                   K = D × v   (cezası 4 kat olanın sayfası da 4 kat)
// 4) Kefaret gününde hedefin üstüne okunan:     e = günlük hedef × zam%   (her ekibin kendi hedefi üzerinden)
// 5) Gereken kefaret günü:                      N = K / e   (yukarı yuvarlanır)
// Her tamamlanan kefaret günü indirimin D / N kadarını kazandırır; üye istemezse normal okumaya devam eder.
// Grup toplamında okunacak kefaret sayfası = indirim% × eksik kalan toplam sayfa.
import type { Group, Team } from "@prisma/client";
import { getDb } from "./db";
import { discountPenalties } from "./dues";
import { shownName } from "./names";
import { notifyUsers } from "./notify";
import { MINUTE_STEP, formatAmount, rulesFor, type ReadUnit } from "./rules";
import { currentPeriod } from "./schedule";

const OPEN_DUE = ["PENDING", "SUBMITTED", "OVERDUE"];
export const MAX_DAYS = 120;

export type KefaretRow = {
  userId: string;
  name: string;
  teamName: string | null;
  penaltyTotal: number;
  missedPages: number;
  discountTotal: number;
  pages: number;
  target: number;
  /** Okuma hesabı (saat hesabında pages/target/dailyExtra dakika) */
  unit: ReadUnit;
  dailyExtra: number;
  days: number;
  /** Zaten süren kefareti var (yenisi başlatılmaz) */
  active: boolean;
};

type G = Group & { teams: Team[] };

/** Ödenmemiş (vadeli ya da vadesiz, açık) cezalar kişi başına: toplam TL ve eksik kalan sayfa */
async function openPenalties(groupId: string) {
  const rows = await getDb().penalty.findMany({
    where: { groupId, status: { in: ["UNPAID", "IN_DUE"] } },
    select: { userId: true, amount: true, pagesRead: true, requiredPages: true, due: { select: { status: true } } },
  });
  const by = new Map<string, { c: number; m: number }>();
  for (const p of rows) {
    if (p.due && !OPEN_DUE.includes(p.due.status)) continue;
    const cur = by.get(p.userId) ?? { c: 0, m: 0 };
    cur.c += p.amount;
    cur.m += Math.max(0, p.requiredPages - p.pagesRead);
    by.set(p.userId, cur);
  }
  return by;
}

/** Önizleme: kim, ne kadar indirim için günde kaç ek sayfayla kaç gün okuyacak */
export async function previewKefaret(groupId: string, discountPercent: number, raisePercent: number, onlyUserId?: string) {
  const db = getDb();
  const group = await db.group.findUniqueOrThrow({
    where: { id: groupId },
    include: { teams: true, members: { where: { status: "ACTIVE" }, include: { user: { select: { id: true, name: true, accountName: true } } } } },
  });
  const [open, active] = await Promise.all([openPenalties(groupId), db.kefaretPlan.findMany({ where: { groupId, status: "ACTIVE" }, select: { userId: true } })]);
  const busy = new Set(active.map((a) => a.userId));
  // Ortak sayfa (ya da dakika) değeri grubun tüm açık cezalarından (tek kişiye yapılsa da aynı ölçü);
  // sayfa ve saat hesaplı okuyucular kendi aralarında ölçülür
  const unitOf = new Map(group.members.map((m) => [m.userId, rulesFor(group, m).readUnit]));
  const sums = { PAGES: { c: 0, m: 0 }, MINUTES: { c: 0, m: 0 } };
  for (const [uid, v] of open) {
    const u = sums[unitOf.get(uid) ?? "PAGES"];
    u.c += v.c;
    u.m += v.m;
  }
  const valueOf = (u: ReadUnit) => (sums[u].c > 0 ? sums[u].m / sums[u].c : 0);
  const pageValue = valueOf("PAGES");
  const rows: KefaretRow[] = [];
  for (const m of group.members) {
    if (onlyUserId && m.userId !== onlyUserId) continue;
    const o = open.get(m.userId);
    if (!o || o.c <= 0) continue;
    const r = rulesFor(group, m);
    const discountTotal = Math.round((o.c * discountPercent) / 100);
    if (discountTotal <= 0) continue;
    // Saat hesabında toplam ek süre ve günlük ek 15 dakikanın katı (yukarı yuvarlanır)
    const step = r.readUnit === "MINUTES" ? MINUTE_STEP : 1;
    const up = (n: number) => Math.max(step, Math.ceil(n / step) * step);
    const pages = up(discountTotal * valueOf(r.readUnit));
    const dailyExtra = r.readUnit === "MINUTES" ? up((r.targetPages * raisePercent) / 100) : Math.max(1, Math.round((r.targetPages * raisePercent) / 100));
    rows.push({
      userId: m.userId,
      name: shownName(m.user, group.nameDisplay),
      teamName: r.teamName,
      penaltyTotal: o.c,
      missedPages: o.m,
      discountTotal,
      pages,
      target: r.targetPages,
      unit: r.readUnit,
      dailyExtra,
      days: Math.ceil(pages / dailyExtra),
      active: busy.has(m.userId),
    });
  }
  rows.sort((a, b) => b.penaltyTotal - a.penaltyTotal);
  return { group, pageValue, rows };
}

export async function startKefaret(groupId: string, adminId: string, discountPercent: number, raisePercent: number, onlyUserId?: string) {
  const { group, pageValue, rows } = await previewKefaret(groupId, discountPercent, raisePercent, onlyUserId);
  const todo = rows.filter((r) => !r.active);
  if (!todo.length) throw new Error(rows.length ? "Seçilenlerin zaten süren kefaret okuması var" : "İndirim yapılacak ödenmemiş ceza yok");
  const tooLong = todo.find((r) => r.days > MAX_DAYS);
  if (tooLong) throw new Error(`${tooLong.name} için ${tooLong.days} gün gerekiyor (en fazla ${MAX_DAYS}). Zam oranını artırın ya da indirimi azaltın.`);
  const startDay = currentPeriod(new Date(), group).dayKey;
  await getDb().kefaretPlan.createMany({
    data: todo.map((r) => ({
      groupId,
      userId: r.userId,
      createdById: adminId,
      discountPercent,
      raisePercent,
      penaltyTotal: r.penaltyTotal,
      missedPages: r.missedPages,
      discountTotal: r.discountTotal,
      pageValue,
      pages: r.pages,
      dailyExtra: r.dailyExtra,
      days: r.days,
      startDay,
    })),
  });
  await Promise.allSettled(
    todo.map((r) =>
      notifyUsers(
        [r.userId],
        {
          title: `📗 ${group.name}: kefaret okuması`,
          body: `Cezana %${discountPercent} indirim (${r.discountTotal} TL) kazanabilirsin: ${r.days} gün, günde ${formatAmount(r.target + r.dailyExtra, r.unit, true)} oku. Gün kartındaki "Kefaret okuması" butonunu kullan; istemezsen normal okumaya devam edebilirsin.`,
          url: `/gruplar/${groupId}`,
        },
        { inApp: true },
      ),
    ),
  );
  return todo.length;
}

/** Üyenin süren kefaret planı (gün kartı için) */
export async function activeKefaret(groupId: string, userId: string) {
  return getDb().kefaretPlan.findFirst({ where: { groupId, userId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
}

/**
 * Gün kapanınca (ceza hesabıyla birlikte): o gün kefaret okuması bildirenlerin planı ilerler ve
 * indirimin o güne düşen payı cezalarından düşülür.
 */
export async function processKefaretDay(g: Pick<G, "id" | "name">, dayKey: string) {
  const db = getDb();
  const logs = await db.readingLog.findMany({ where: { groupId: g.id, dayKey, kefaretPlanId: { not: null }, kefaret: { gt: 0 } } });
  for (const log of logs) {
    const plan = await db.kefaretPlan.findUnique({ where: { id: log.kefaretPlanId! } });
    if (!plan || plan.status !== "ACTIVE" || plan.userId !== log.userId || dayKey < plan.startDay) continue;
    if (log.pages < log.requiredPages + plan.dailyExtra) continue;
    const done = plan.doneDays + 1;
    // Son gün kalan tamamını kazandırır (yuvarlama kaybı olmasın)
    const chunk = Math.round((plan.discountTotal * done) / plan.days) - Math.round((plan.discountTotal * plan.doneDays) / plan.days);
    let saved = 0;
    let noDebt = false;
    if (chunk > 0) {
      try {
        saved = (await discountPenalties({ groupId: g.id, userId: plan.userId, mode: "amount", value: chunk })).saved;
      } catch {
        noDebt = true; // indirim yapılacak borç kalmadı (ödendi ya da affedildi)
      }
    }
    const finished = done >= plan.days || noDebt;
    await db.kefaretPlan.update({
      where: { id: plan.id },
      data: { doneDays: done, earned: { increment: saved }, ...(finished ? { status: "DONE", endedAt: new Date() } : {}) },
    });
    if (finished) {
      await notifyUsers(
        [plan.userId],
        { title: `📗 ${g.name}: kefaret tamamlandı`, body: `Kefaret okuman bitti; toplam ${plan.earned + saved} TL indirim kazandın. Allah kabul etsin.`, url: `/gruplar/${g.id}` },
        { inApp: true },
      ).catch(() => {});
    }
  }
}

export async function cancelKefaret(planId: string) {
  const db = getDb();
  const plan = await db.kefaretPlan.findUniqueOrThrow({ where: { id: planId } });
  if (plan.status !== "ACTIVE") throw new Error("Bu kefaret okuması zaten bitmiş");
  await db.kefaretPlan.update({ where: { id: plan.id }, data: { status: "CANCELLED", endedAt: new Date() } });
  return plan;
}
