"use client";

import Link from "next/link";
import { useState } from "react";

export function QuickReport({ token }: { token: string }) {
  const [pages, setPages] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(choice: "min" | "none" | "pages") {
    setBusy(true);
    const res = await fetch("/api/quick-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, choice, pages: choice === "pages" ? Number(pages) : undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setResult(res.ok ? { ok: true, text: `${data.pages} sayfa bildirildi ✓` } : { ok: false, text: data.error ?? "Bir hata oluştu" });
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
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className="input text-lg"
          placeholder="Kaç sayfa?"
          value={pages}
          onChange={(e) => setPages(e.target.value)}
        />
        <button className="btn-success shrink-0" disabled={busy || pages === ""} onClick={() => send("pages")}>
          📖 Okudum
        </button>
      </div>
      <button className="btn-primary w-full py-3" disabled={busy} onClick={() => send("min")}>
        ✅ Alt sınırı okudum
      </button>
      <button className="btn-ghost w-full py-3" disabled={busy} onClick={() => send("none")}>
        ❌ Okumadım
      </button>
      {result && !result.ok && <p className="text-center text-sm text-destructive">{result.text}</p>}
    </div>
  );
}
