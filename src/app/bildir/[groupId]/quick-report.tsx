"use client";

import { BookOpenCheck, Check, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatAmount, formatMinutes, type ReadUnit } from "@/lib/rules";

export function QuickReport({ token, unit = "PAGES" }: { token: string; unit?: ReadUnit }) {
  const [pages, setPages] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(choice: "all" | "min" | "none" | "pages") {
    setBusy(true);
    const res = await fetch("/api/quick-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, choice, pages: choice === "pages" ? Number(pages) : undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setResult(res.ok ? { ok: true, text: `${formatAmount(data.pages ?? 0, unit, true)} bildirildi ✓` } : { ok: false, text: data.error ?? "Bir hata oluştu" });
    setBusy(false);
  }

  if (result?.ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg font-semibold text-emerald-600">{result.text}</p>
        <Link href="/panel" className="btn-primary">
          Uygulamaya git
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {unit === "MINUTES" ? (
          // Saat hesabı: 15 dakikalık adımlarla süre
          <select className="input text-lg" value={pages} onChange={(e) => setPages(e.target.value)} aria-label="Ne kadar okudun?">
            <option value="">Ne kadar okudun?</option>
            {Array.from({ length: 40 }, (_, i) => (i + 1) * 15).map((m) => (
              <option key={m} value={m}>
                {formatMinutes(m)}
              </option>
            ))}
          </select>
        ) : (
          <input type="number" inputMode="numeric" min={0} className="input text-lg" placeholder="Kaç sayfa?" value={pages} onChange={(e) => setPages(e.target.value)} />
        )}
        <button className="btn-success shrink-0" disabled={busy || pages === ""} onClick={() => send("pages")}>
          <BookOpenCheck /> Okudum
        </button>
      </div>
      <button className="btn-success w-full py-3" disabled={busy} onClick={() => send("all")}>
        <BookOpenCheck /> Hedefi okudum
      </button>
      <button className="btn-primary w-full py-3" disabled={busy} onClick={() => send("min")}>
        <Check /> Alt sınırı okudum
      </button>
      <button className="btn-ghost w-full py-3" disabled={busy} onClick={() => send("none")}>
        <X /> Okumadım
      </button>
      {result && !result.ok && <p className="text-center text-sm text-destructive">{result.text}</p>}
    </div>
  );
}
