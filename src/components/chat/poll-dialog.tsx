"use client";

import { BarChart3, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createPoll } from "@/app/actions";

export function PollDialog({ groupId, onClose, onCreated }: { groupId: string; onClose: () => void; onCreated: () => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("question", question);
      fd.set("options", JSON.stringify(options));
      fd.set("multiple", multiple ? "1" : "0");
      const res = await createPoll(null, fd);
      if (res?.error) return setError(res.error);
      onCreated();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="pb-safe w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <BarChart3 className="size-5 text-primary" /> Anket oluştur
          </h2>
          <button className="btn-icon size-8" onClick={onClose} aria-label="Kapat">
            <X />
          </button>
        </div>
        <label className="label">Soru</label>
        <input className="input mb-4" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Örn. Bu ay hangi kitabı okuyalım?" maxLength={300} autoFocus />
        <label className="label">Seçenekler</label>
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                value={o}
                maxLength={100}
                placeholder={`Seçenek ${i + 1}`}
                onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {options.length > 2 && (
                <button className="btn-icon" onClick={() => setOptions((all) => all.filter((_, j) => j !== i))} aria-label="Seçeneği sil">
                  <Trash2 />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 10 && (
          <button className="btn-quiet btn-sm mt-2" onClick={() => setOptions((all) => [...all, ""])}>
            <Plus /> Seçenek ekle
          </button>
        )}
        <label className="mt-4 flex cursor-pointer items-center justify-between rounded-lg border border-border p-3">
          <span className="text-sm font-medium">Birden fazla seçime izin ver</span>
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="size-5 accent-primary" />
        </label>
        {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
        <button className="btn-primary mt-4 w-full" onClick={submit} disabled={pending}>
          {pending ? "Gönderiliyor..." : "Anketi gönder"}
        </button>
      </div>
    </div>
  );
}
