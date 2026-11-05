// Uçtan uca test: geçici Clerk kullanıcılarıyla gerçek API. Kullanım: node scripts/_e2e.mts <BASE_URL>
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "node:process";
import { currentPeriod, shiftDayKey } from "../src/lib/schedule.ts";
loadEnvFile(".env");
const BASE = process.argv[2] ?? "http://localhost:3123";
const CK = process.env.CLERK_SECRET_KEY!;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) fails++; console.log(`${c ? "✅" : "❌"} ${m}`); };
const clerk = async (path: string, body?: unknown, method = body ? "POST" : "GET") => {
  const r = await fetch(`https://api.clerk.com/v1${path}`, { method, headers: { authorization: `Bearer ${CK}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
};
const clerkIds: string[] = [];
let groupId = "";
const times: number[] = [];
const wait = async (pred: () => boolean, ms = 10000) => { const s = Date.now(); while (!pred() && Date.now() - s < ms) await new Promise((r) => setTimeout(r, 50)); return pred(); };
try {
  const stamp = Date.now();
  const users: { id: string; session: string }[] = [];
  for (const [first, last] of [["Ayşe", "Test"], ["Mehmet", "Deneme"]]) {
    const u = await clerk("/users", { email_address: [`e2e+${first.toLowerCase()}${stamp}@example.com`], first_name: first, last_name: last, password: `Okuma-${stamp}-x!`, skip_password_checks: true });
    clerkIds.push(u.id);
    users.push({ id: u.id, session: (await clerk("/sessions", { user_id: u.id })).id });
  }
  const token = async (i: number) => (await clerk(`/sessions/${users[i].session}/tokens`, { expires_in_seconds: 900 })).jwt as string;
  const tA = await token(0), tB = await token(1);
  const api = async (t: string, path: string, body?: unknown) => {
    const t0 = Date.now();
    const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const out = { status: r.status, json: await r.json().catch(() => ({})) };
    times.push(Date.now() - t0);
    return out;
  };

  ok((await api(tA, "/api/m/me")).status === 200, "Clerk token ile API'ye giriş");
  await api(tB, "/api/m/me");
  const teams = JSON.stringify([
    { name: "Hızlılar", penaltyMode: "FIXED", targetPages: 30, minPages: 15, penaltyAmount: 40, minDiscount: 50 },
    { name: "Yavaşlar", penaltyMode: "FIXED", targetPages: 10, minPages: 5, penaltyAmount: 20, minDiscount: 25 },
  ]);
  const cg = await api(tA, "/api/m/action/createGroup", { name: "E2E Sohbet", visibility: "PRIVATE", chatPolicy: "ALL", penaltyMode: "FIXED", targetPages: 20, minPages: 10, penaltyAmount: 20, minDiscount: 50, teamsEnabled: "1", teams, startTime: "00:00", deadlineTime: "23:59", reminderHours: 2 });
  groupId = cg.json.id;
  ok(groupId, `Ekipli grup oluşturuldu ${cg.json.error ?? ""}`);
  const tm = await db.team.findMany({ where: { groupId }, orderBy: { position: "asc" } });
  ok(tm.length === 2, `2 ekip kaydedildi (${tm.map((t) => t.name).join(", ")})`);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
  await db.groupMember.create({ data: { groupId, userId: users[1].id, teamId: tm[1].id, joinedAt: threeDaysAgo } });
  await db.groupMember.updateMany({ where: { groupId, userId: users[0].id }, data: { joinedAt: threeDaysAgo } });

  const chat = await api(tB, `/api/m/groups/${groupId}/chat`);
  const day = chat.json.messages?.find((m: { kind: string }) => m.kind === "DAY");
  ok(chat.status === 200 && day, "Sohbet açıldı ve bugünün gün kartı oluştu");
  ok(day?.day?.pending?.length === 2 && day?.day?.me?.target === 10, `Gün kartı: 2 kişi bekleniyor, B'nin hedefi ekibine göre ${day?.day?.me?.target}`);

  // Gerçek zamanlı (SSE)
  const events: { type: string; reason?: string; message?: { text: string } }[] = [];
  const ctrl = new AbortController();
  const sse = await fetch(`${BASE}/api/m/groups/${groupId}/events?after=${chat.json.cursor}`, { headers: { authorization: `Bearer ${tB}` }, signal: ctrl.signal });
  ok(sse.status === 200 && (sse.headers.get("content-type") ?? "").includes("text/event-stream"), "SSE akışı açıldı");
  (async () => {
    const reader = sse.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const data = buf.slice(0, i).split("\n").find((l) => l.startsWith("data: "));
          buf = buf.slice(i + 2);
          if (data) events.push(JSON.parse(data.slice(6)));
        }
      }
    } catch {}
  })();
  ok((await fetch(`${BASE}/api/m/groups/${groupId}/events?once=1`)).status === 401, "Oturumsuz olay isteği reddedildi");

  const t0 = Date.now();
  const sm = await api(tA, "/api/m/action/sendMessage", { groupId, text: "Merhaba okurlar!" });
  ok(sm.status === 200 && (await wait(() => events.some((e) => e.type === "message" && e.message?.text === "Merhaba okurlar!"))), `Mesaj diğer üyeye canlı ulaştı (${Date.now() - t0} ms)`);
  const once = await api(tB, `/api/m/groups/${groupId}/events?once=1&after=${chat.json.cursor}`);
  ok(once.json.events?.some((e: { type: string }) => e.type === "message"), "Mobil yoklama uç noktası olayları döndürdü");

  events.length = 0;
  await api(tA, "/api/m/action/reportReading", { groupId, choice: "pages", pages: 15 });
  await api(tB, "/api/m/action/reportReading", { groupId, choice: "min" });
  ok(await wait(() => events.filter((e) => e.reason === "day").length >= 2), "Okuma bildirimleri sohbete canlı yansıdı");
  const d2 = (await api(tB, `/api/m/groups/${groupId}/chat`)).json.messages.find((m: { kind: string }) => m.kind === "DAY").day;
  ok(d2.min.length === 2 && d2.read.length === 0, `Gün kartı ekip kurallarıyla: alt sınır = ${d2.min.map((p: { name: string; pages: number }) => `${p.name.split(" ")[0]}(${p.pages})`)}`);
  const logs = await db.readingLog.findMany({ where: { groupId }, orderBy: { pages: "desc" } });
  ok(logs[0]?.requiredPages === 30 && logs[1]?.pages === 5 && logs[1]?.minPages === 5, "Okumalar ekip hedefleriyle kaydedildi");

  const cp = await api(tA, "/api/m/action/createPoll", { groupId, question: "Sıradaki kitap?", options: JSON.stringify(["Suç ve Ceza", "Kürk Mantolu Madonna", "Simyacı"]), multiple: "0" });
  ok(cp.status === 200, "Anket oluşturuldu");
  const poll = (await api(tB, `/api/m/groups/${groupId}/chat`)).json.messages.find((m: { kind: string }) => m.kind === "POLL").poll;
  await api(tB, "/api/m/action/votePoll", { optionId: poll.options[1].id });
  await api(tB, "/api/m/action/votePoll", { optionId: poll.options[0].id });
  await api(tA, "/api/m/action/votePoll", { optionId: poll.options[0].id });
  const p4 = (await api(tB, `/api/m/groups/${groupId}/chat`)).json.messages.find((m: { kind: string }) => m.kind === "POLL").poll;
  ok(p4.options[0].votes === 2 && p4.options[1].votes === 0 && p4.voters === 2, `Oylar doğru (${p4.options.map((o: { votes: number }) => o.votes).join("/")})`);

  await db.group.update({ where: { id: groupId }, data: { chatPolicy: "ADMINS" } });
  const sB = await api(tB, "/api/m/action/sendMessage", { groupId, text: "üye" });
  const sA = await api(tA, "/api/m/action/sendMessage", { groupId, text: "yönetici" });
  ok(sB.status === 400 && sA.status === 200, "Yalnızca yöneticiler ayarı çalışıyor");
  const delB = await api(tB, "/api/m/action/deleteMessage", { messageId: sm.json.id });
  const delA = await api(tA, "/api/m/action/deleteMessage", { messageId: sm.json.id });
  ok(delB.status === 400 && delA.status === 200, "Silme yetkisi doğru");

  // Ceza: dün A 15/30 (alt sınır) → 40 TL'nin %50'si = 20; B hiç → 20
  const g0 = await db.group.findUniqueOrThrow({ where: { id: groupId } });
  const prev = shiftDayKey(currentPeriod(new Date(), g0).dayKey, -1);
  await db.readingLog.create({ data: { groupId, userId: users[0].id, dayKey: prev, pages: 15, requiredPages: 30, minPages: 15 } });
  await db.group.update({ where: { id: groupId }, data: { lastSettledDay: shiftDayKey(prev, -1) } });
  const cr = await fetch(`${BASE}/api/cron`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  ok(cr.status === 200, `Zamanlanmış görev çalıştı ${JSON.stringify(await cr.json().catch(() => ({})))}`);
  const pens = await db.penalty.findMany({ where: { groupId, dayKey: prev } });
  const pa = pens.find((p) => p.userId === users[0].id)?.amount, pb = pens.find((p) => p.userId === users[1].id)?.amount;
  ok(pa === 20 && pb === 20, `İndirimli ceza: A alt sınır → ${pa} TL, B okumadı → ${pb} TL`);

  const tc = await api(tB, "/api/m/action/requestTeamChange", { groupId, teamId: tm[0].id });
  const req = await db.teamChangeRequest.findFirst({ where: { groupId, userId: users[1].id, status: "PENDING" } });
  const before = await db.groupMember.findFirstOrThrow({ where: { groupId, userId: users[1].id } });
  ok(tc.status === 200 && req && before.teamId === tm[1].id, "Ekip değişikliği yönetici onayına gitti");
  await api(tA, "/api/m/action/respondTeamChange", { requestId: req!.id, accept: "1" });
  ok((await db.groupMember.findFirstOrThrow({ where: { groupId, userId: users[1].id } })).teamId === tm[0].id, "Onaylanınca ekip değişti");

  const today = (await api(tB, "/api/m/me")).json.groups?.[0];
  ok(today?.card?.dayKey && !("week" in today), "Bugün verisi: gün kartı var, başkalarının geçmişi yok");

  // ---- Eserler: 2 kitaplı grup (ekipsiz) ----
  const books = JSON.stringify([
    { title: "Suç ve Ceza", targetPages: 20, minPages: 10 },
    { title: "Simyacı", targetPages: 10, minPages: 5 },
  ]);
  const g2 = (await api(tA, "/api/m/action/createGroup", { name: "E2E Eserler", visibility: "PRIVATE", chatPolicy: "ALL", penaltyMode: "FIXED", penaltyAmount: 40, minDiscount: 50, books, teamsEnabled: "0", teams: "[]", startTime: "00:00", deadlineTime: "23:59", reminderHours: 2 })).json;
  const grp2 = await db.group.findUniqueOrThrow({ where: { id: g2.id } });
  ok(grp2.targetPages === 30 && grp2.minPages === 15 && (grp2.books as unknown[]).length === 2, `2 eser kaydedildi, toplam hedef ${grp2.targetPages} / alt sınır ${grp2.minPages}`);
  await db.groupMember.create({ data: { groupId: g2.id, userId: users[1].id, joinedAt: threeDaysAgo } });
  const c2 = (await api(tB, `/api/m/groups/${g2.id}/chat`)).json;
  const myBooks = c2.messages.find((m: { kind: string }) => m.kind === "DAY").day.me.books;
  ok(myBooks.length === 2 && myBooks[0].title === "Suç ve Ceza", "Gün kartında eserler listeleniyor");
  await api(tB, "/api/m/action/reportReading", { groupId: g2.id, bookId: myBooks[0].id, bookChoice: "read" });
  let lg = await db.readingLog.findFirstOrThrow({ where: { groupId: g2.id, userId: users[1].id } });
  ok(lg.pages === 20 && lg.requiredPages === 30, `Tek esere "okudum": ${lg.pages}/${lg.requiredPages} sayfa`);
  await api(tB, "/api/m/action/reportReading", { groupId: g2.id, bookId: myBooks[1].id, bookChoice: "min" });
  lg = await db.readingLog.findFirstOrThrow({ where: { groupId: g2.id, userId: users[1].id } });
  ok(lg.pages === 25, `İkinci esere "alt sınır": toplam ${lg.pages} sayfa (20 + 5)`);
  await api(tB, "/api/m/action/reportReading", { groupId: g2.id, choice: "all" });
  lg = await db.readingLog.findFirstOrThrow({ where: { groupId: g2.id, userId: users[1].id } });
  ok(lg.pages === 30, `"Hepsini okudum": ${lg.pages} sayfa`);
  await api(tB, "/api/m/action/reportReading", { groupId: g2.id, choice: "min" });
  const d3 = (await api(tB, `/api/m/groups/${g2.id}/chat`)).json.messages.find((m: { kind: string }) => m.kind === "DAY").day;
  ok(d3.min.length === 1 && d3.me.pages === 15, `"Alt sınırı okudum": ${d3.me.pages} sayfa, kartta alt sınırda`);

  // ---- Geçmiş ve gizlilik ----
  for (const r of ["7d", "1m", "3m", "1y", "all"]) {
    const h = (await api(tB, `/api/m/history?range=${r}`)).json;
    if (r === "7d") ok(h.groups?.length === 2 && h.all && h.groups.every((g: { cells: string }) => g.cells.length === 7), "Kişisel geçmiş: 2 grup + tüm gruplar, 7 gün");
    if (r === "1y") ok(h.groups?.[0]?.cells.length === 365, `1 yıllık geçmiş: ${h.groups?.[0]?.cells.length} gün`);
  }
  const hB = (await api(tB, `/api/m/groups/${g2.id}/history?range=1m`)).json;
  const hA = (await api(tA, `/api/m/groups/${g2.id}/history?range=1m`)).json;
  ok(hB.limited && hB.rows.length === 1 && hB.rows[0].me, "Paylaşım kapalı: üye yalnızca kendini görüyor");
  ok(!hA.limited && hA.rows.length === 2, "Yönetici tüm üyelerin geçmişini görüyor");
  await db.group.update({ where: { id: g2.id }, data: { shareProgress: true } });
  const hB2 = (await api(tB, `/api/m/groups/${g2.id}/history?range=7d`)).json;
  ok(!hB2.limited && hB2.rows.length === 2, "Paylaşım açılınca üye de herkesi görüyor");
  await db.group.delete({ where: { id: g2.id } });
  ctrl.abort();
  times.sort((a, b) => a - b);
  console.log(`   ⏱  ${times.length} istek · ortanca ${times[Math.floor(times.length / 2)]} ms · en yavaş ${times.at(-1)} ms`);
} catch (e) {
  fails++;
  console.log("❌ HATA:", (e as Error).message);
} finally {
  if (groupId) await db.group.delete({ where: { id: groupId } }).catch(() => {});
  for (const id of clerkIds) {
    await clerk(`/users/${id}`, undefined, "DELETE").catch(() => {});
    await db.user.delete({ where: { id } }).catch(() => {});
  }
  console.log(`🧹 Test verileri silindi · ${fails ? `${fails} hata` : "tümü başarılı"}`);
  process.exit(fails ? 1 : 0);
}
