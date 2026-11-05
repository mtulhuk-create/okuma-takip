import { AlarmClock, BookOpen, Coins, MessagesSquare } from "lucide-react";
import { describePenalty, pickRules } from "@/lib/rules";
import { minuteToTime } from "@/lib/schedule";

type G = Parameters<typeof pickRules>[0] & { startMinute: number; deadlineMinute: number; chatPolicy?: "ALL" | "ADMINS" };

/** Grubun (ya da üyenin ekibinin) okunacak eserlerini ve kurallarını gösterir */
export function GroupRules({ group, title }: { group: G; title?: string }) {
  const r = pickRules(group);
  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-semibold text-muted-foreground">{title}</p>}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <BookOpen className="size-3.5 text-primary" /> Okunacak {r.books.length > 1 ? `${r.books.length} eser` : "eser"}
        </p>
        <ul className="space-y-1.5">
          {r.books.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-semibold">{b.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                günde {b.targetPages} · alt sınır {b.minPages}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <Coins className="mb-2 size-5 text-primary" />
          <p className="text-[11px] text-muted-foreground">Ceza</p>
          <p className="text-sm font-semibold leading-snug">{describePenalty(r)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <AlarmClock className="mb-2 size-5 text-primary" />
          <p className="text-[11px] text-muted-foreground">Okuma günü</p>
          <p className="text-sm font-semibold">
            {minuteToTime(group.startMinute)} – {minuteToTime(group.deadlineMinute)}
          </p>
        </div>
        {group.chatPolicy && (
          <div className="rounded-xl border border-border bg-card p-3">
            <MessagesSquare className="mb-2 size-5 text-primary" />
            <p className="text-[11px] text-muted-foreground">Sohbet</p>
            <p className="text-sm font-semibold">{group.chatPolicy === "ALL" ? "Herkes yazabilir" : "Yalnızca yöneticiler"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
