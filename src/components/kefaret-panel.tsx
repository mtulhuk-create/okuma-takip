"use client";

import { BookHeart, Info, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { cancelKefaretAction, startKefaretAction } from "@/app/actions";
import { formatAmount } from "@/lib/rules";

type Row = { userId: string; name: string; teamName: string | null; penaltyTotal: number; missedPages: number; discountTotal: number; pages: number; target: number; unit?: "PAGES" | "MINUTES"; dailyExtra: number; days: number; active: boolean };
type Plan = { id: string; userId: string; name: string; status: "ACTIVE" | "DONE"; discountPercent: number; raisePercent: number; discountTotal: number; earned: number; pages: number; dailyExtra: number; days: number; doneDays: number };
type Data = { discount: number; raise: number; maxDays: number; pageValue: number; rows: Row[]; plans: Plan[] };

const DISCOUNTS = [25, 50, 75, 100];
const RAISES = [25, 50, 100];

/**
 * Kefaret okumasıyla indirim: indirim cezalardan doğrudan düşülmez, üyeler hedeflerinin üstüne
 * okuyarak kazanır. Önizleme kimin kaç gün, günde kaç ek sayfa okuyacağını gösterir.
 */
export function KefaretPanel({ groupId }: { groupId: string }) {
  const [discount, setDiscount] = useState(50);
  const [raise, setRaise] = useState(50);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showHow, setShowHow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/m/groups/${groupId}/kefaret?discount=${discount}&raise=${raise}`).catch(() => null);
    if (res?.ok) setData((await res.json()) as Data);
    setLoading(false);
  }, [groupId, discount, raise]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const run = (action: typeof startKefaretAction, fields: Record<string, string>) =>
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await action(null, fd);
      setMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: res?.message ?? "Tamam" });
      await load();
    });

  const todo = data?.rows.filter((r) => !r.active) ?? [];
  const active = data?.plans.filter((p) => p.status === "ACTIVE") ?? [];
  const done = data?.plans.filter((p) => p.status === "DONE") ?? [];

  return (
    <section className="card space-y-3 border-teal-500/30">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
          <BookHeart className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold leading-tight">Kefaret okumasıyla indirim</h2>
          <p className="text-xs text-muted-foreground">İndirim cezadan doğrudan düşülmez: üyeler günlük hedeflerinin üstüne okuyarak kazanır. İstemeyen normal okumaya devam eder.</p>
        </div>
        <button className="btn-icon size-8 shrink-0" onClick={() => setShowHow((v) => !v)} aria-label="Nasıl hesaplanıyor?" title="Nasıl hesaplanıyor?">
          <Info />
        </button>
      </div>

      {showHow && (
        <div className="space-y-1 rounded-lg bg-teal-500/10 p-3 text-xs leading-relaxed">
          <p className="font-semibold text-teal-800 dark:text-teal-300">Adil hesap nasıl yapılıyor?</p>
          <p>
            1. Grubun ödenmemiş cezalarında eksik kalan toplam sayfa, toplam cezaya bölünür: <b>1 TL = {data ? data.pageValue : "…"} sayfa</b>. Bu ölçü herkes için, hangi ekipte olursa olsun aynıdır.
          </p>
          <p>2. Herkesin kazanacağı indirim kendi cezasının yüzdesidir; cezası 4 kat olan 4 kat sayfa okur.</p>
          <p>3. Ek sayfa her kişinin kendi günlük hedefine zam olarak eklenir; kaç gün süreceği buna göre çıkar.</p>
          <p>4. Her kefaret günü indirimin bir payını kazandırır; bıraksa da o ana kadar kazandığı geçerlidir.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="label">Cezalara indirim</p>
          <div className="flex flex-wrap gap-1.5">
            {DISCOUNTS.map((d) => (
              <button key={d} type="button" onClick={() => setDiscount(d)} className={`h-8 rounded-lg border px-3 text-xs font-bold ${discount === d ? "border-teal-600 bg-teal-600 text-white" : "border-border"}`}>
                %{d}
              </button>
            ))}
            <input type="number" min={1} max={100} value={discount} onChange={(e) => setDiscount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} className="input h-8 w-16 px-2 text-xs" aria-label="İndirim oranı" />
          </div>
        </div>
        <div>
          <p className="label">Günlük hedefe zam</p>
          <div className="flex flex-wrap gap-1.5">
            {RAISES.map((r) => (
              <button key={r} type="button" onClick={() => setRaise(r)} className={`h-8 rounded-lg border px-3 text-xs font-bold ${raise === r ? "border-teal-600 bg-teal-600 text-white" : "border-border"}`}>
                %{r}
              </button>
            ))}
            <input type="number" min={5} max={300} value={raise} onChange={(e) => setRaise(Math.min(300, Math.max(5, Number(e.target.value) || 5)))} className="input h-8 w-16 px-2 text-xs" aria-label="Zam oranı" />
          </div>
        </div>
      </div>

      {loading && !data ? (
        <p className="text-xs text-muted-foreground">Hesaplanıyor…</p>
      ) : !data?.rows.length ? (
        <p className="text-sm text-muted-foreground">İndirim yapılacak ödenmemiş ceza yok.</p>
      ) : (
        <div className={`overflow-x-auto rounded-lg border border-border ${loading ? "opacity-60" : ""}`}>
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">Üye</th>
                <th className="px-2 py-1.5 text-right">Ceza</th>
                <th className="px-2 py-1.5 text-right">İndirim</th>
                <th className="px-2 py-1.5 text-right">Kefaret</th>
                <th className="px-2 py-1.5 text-right">Günlük</th>
                <th className="px-2 py-1.5 text-right">Gün</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((r) => (
                <tr key={r.userId} className={r.active ? "text-muted-foreground" : ""}>
                  <td className="max-w-32 px-2 py-1.5">
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{r.active ? "süren kefareti var" : (r.teamName ?? `hedef ${formatAmount(r.target, r.unit)}`)}</p>
                  </td>
                  <td className="px-2 py-1.5 text-right">{r.penaltyTotal} TL</td>
                  <td className="px-2 py-1.5 text-right font-semibold text-teal-700 dark:text-teal-400">{r.discountTotal} TL</td>
                  <td className="px-2 py-1.5 text-right">{formatAmount(r.pages, r.unit)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    <b>{formatAmount(r.target + r.dailyExtra, r.unit)}</b>
                    <span className="block text-[9px] text-muted-foreground">
                      hedef {r.target} + {r.dailyExtra}
                    </span>
                  </td>
                  <td className={`px-2 py-1.5 text-right font-bold ${r.days > data.maxDays ? "text-destructive" : ""}`}>{r.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {todo.length > 0 && (
        <button
          className="btn h-10 w-full bg-teal-600 text-white hover:bg-teal-700"
          disabled={pending || loading}
          onClick={() =>
            confirm(`${todo.length} kişiye %${discount} indirim için günlük hedefe %${raise} zamla kefaret okuması başlatılsın mı?`) &&
            run(startKefaretAction, { groupId, discount: String(discount), raise: String(raise) })
          }
        >
          <BookHeart /> {todo.length} kişi için kefaret okumasını başlat
        </button>
      )}
      {msg && <p className={`text-xs font-medium ${msg.ok ? "text-teal-700 dark:text-teal-400" : "text-destructive"}`}>{msg.text}</p>}

      {active.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground">Süren kefaret okumaları</p>
          <ul className="space-y-1.5">
            {active.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg bg-teal-500/10 px-2.5 py-1.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    %{p.discountPercent} indirim · günde +{p.dailyExtra} sf · {p.doneDays}/{p.days} gün · {p.earned}/{p.discountTotal} TL
                  </p>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full bg-teal-500" style={{ width: `${Math.round((p.doneDays / p.days) * 100)}%` }} />
                  </span>
                </div>
                <button className="btn-icon size-7 [&_svg]:size-3.5" disabled={pending} aria-label="Durdur" title="Durdur" onClick={() => confirm(`${p.name} için kefaret okuması durdurulsun mu? Kazanılan indirim geçerli kalır.`) && run(cancelKefaretAction, { planId: p.id })}>
                  <X />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {done.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Tamamlanan: {done.map((p) => `${p.name} (${p.earned} TL)`).join(", ")}
        </p>
      )}
    </section>
  );
}
