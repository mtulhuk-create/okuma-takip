"use client";

import { Landmark, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/schedule";
import { CopyButton } from "./copy-button";

export type PayItem = {
  group: { id: string; name: string; iban: string; ibanName: string };
  amount: number;
  due: { amount: number; dueAt: string | Date; status: string } | null;
};

const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

/** Alttan açılan ödeme penceresi: borcu olan grupların IBAN bilgileri alt alta */
export function PaySheet({ items, title, onClose }: { items: PayItem[]; title: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="pb-safe max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Wallet className="size-5 text-primary" /> {title}
          </h2>
          <button className="btn-icon size-8" onClick={onClose} aria-label="Kapat">
            <X />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ödenmemiş cezan yok 🎉</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((d) => (
              <li key={d.group.id} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/gruplar/${d.group.id}/bilgi`} className="min-w-0 truncate text-sm font-semibold hover:underline" onClick={onClose}>
                    {d.group.name}
                  </Link>
                  <span className="shrink-0 text-base font-bold text-destructive">{d.amount} TL</span>
                </div>
                {d.due && (
                  <p className="text-[11px] text-muted-foreground">
                    {d.due.status === "SUBMITTED" ? "Ödeme bildirildi, onay bekleniyor" : `Son ödeme ${formatDateTime(new Date(d.due.dueAt))}`}
                  </p>
                )}
                {d.group.iban ? (
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      <Landmark className="size-3" /> Grup kasası IBAN
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="break-all font-mono text-[13px] font-semibold">{formatIban(d.group.iban)}</p>
                      <CopyButton text={d.group.iban} />
                    </div>
                    {d.group.ibanName && <p className="text-xs">{d.group.ibanName}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Yönetici henüz IBAN girmedi.</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">Ödedikten sonra grup bilgisi sayfasından &quot;Ödedim&quot; demeyi unutma.</p>
      </div>
    </div>
  );
}

/** Bugün başlığındaki toplam borç; tıklanınca IBAN'lar açılır */
export function DebtButton({ total, items }: { total: number; items: PayItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${total ? "bg-destructive/10 text-destructive hover:bg-destructive/15" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}
        title="Tüm gruplardaki toplam borcun"
      >
        <Wallet className="size-4" />
        {total ? `${total} TL borç` : "Borç yok"}
      </button>
      {open && <PaySheet title="Borçlarım" items={items} onClose={() => setOpen(false)} />}
    </>
  );
}
