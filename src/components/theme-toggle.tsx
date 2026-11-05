"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Açık", Icon: Sun },
  { value: "dark", label: "Koyu", Icon: Moon },
  { value: "system", label: "Sistem", Icon: Monitor },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme((localStorage.getItem("theme") as Theme) || "system"), []);

  function choose(t: Theme) {
    setTheme(t);
    localStorage.setItem("theme", t);
    (window as unknown as { __applyTheme?: () => void }).__applyTheme?.();
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-lg border border-border bg-muted p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => choose(value)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${
            theme === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-4" />
          {!compact && label}
        </button>
      ))}
    </div>
  );
}
