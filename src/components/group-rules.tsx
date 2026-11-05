import { AlarmClock, BookOpen, Coins, MessagesSquare } from "lucide-react";
import { describePenalty, type Rules } from "@/lib/rules";
import { minuteToTime } from "@/lib/schedule";

type G = Rules & { startMinute: number; deadlineMinute: number; chatPolicy?: "ALL" | "ADMINS" };

/** Grubun (ya da üyenin ekibinin) kurallarını sade, ikonlu kutucuklarla gösterir */
export function GroupRules({ group, title }: { group: G; title?: string }) {
  const items = [
    { Icon: BookOpen, label: "Günlük hedef", value: `${group.targetPages} sayfa`, sub: `Alt sınır ${group.minPages}` },
    { Icon: Coins, label: "Ceza", value: describePenalty(group) },
    { Icon: AlarmClock, label: "Okuma günü", value: `${minuteToTime(group.startMinute)} – ${minuteToTime(group.deadlineMinute)}` },
    ...(group.chatPolicy ? [{ Icon: MessagesSquare, label: "Sohbet", value: group.chatPolicy === "ALL" ? "Herkes yazabilir" : "Yalnızca yöneticiler" }] : []),
  ];
  return (
    <div className="space-y-2">
      {title && <p className="text-xs font-semibold text-muted-foreground">{title}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(({ Icon, label, value, sub }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3">
            <Icon className="mb-2 size-5 text-primary" />
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold leading-snug">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
