import { Check, CheckCheck, Clock, Minus, X } from "lucide-react";
import type { WeekCell } from "@/lib/queries";
import { Avatar } from "./avatar";

const CELL: Record<WeekCell, { Icon: typeof Check; cls: string; title: string }> = {
  read: { Icon: CheckCheck, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", title: "Okudu" },
  min: { Icon: Check, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400", title: "Alt sınır" },
  none: { Icon: X, cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400", title: "Okumadı" },
  pending: { Icon: Clock, cls: "bg-muted text-muted-foreground", title: "Bekleniyor" },
  na: { Icon: Minus, cls: "text-muted-foreground/40", title: "Üye değildi" },
};

const DOW = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];

export function WeekTable({
  days,
  rows,
}: {
  days: string[];
  rows: { user: { id: string; name: string; imageUrl: string | null }; cells: WeekCell[] }[];
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1 text-center text-sm">
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th className="w-full" />
            {days.map((d, i) => {
              const [y, m, day] = d.split("-").map(Number);
              return (
                <th key={d} className={`px-0.5 font-semibold ${i === days.length - 1 ? "text-primary" : ""}`}>
                  <div>{DOW[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]}</div>
                  <div className="text-[10px] font-normal">{day}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user.id}>
              <td className="pr-2 text-left">
                <div className="flex items-center gap-2">
                  <Avatar name={r.user.name} src={r.user.imageUrl} size={26} />
                  <span className="max-w-[7.5rem] truncate text-xs font-medium sm:max-w-[12rem]">{r.user.name.split(" ")[0]}</span>
                </div>
              </td>
              {r.cells.map((c, i) => {
                const { Icon, cls, title } = CELL[c];
                return (
                  <td key={i} className="px-0.5">
                    <span title={title} className={`mx-auto flex size-7 items-center justify-center rounded-md ${cls}`}>
                      <Icon className="size-3.5" strokeWidth={2.5} />
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
