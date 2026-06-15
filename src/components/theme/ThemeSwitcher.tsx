"use client";

import { Check } from "lucide-react";
import { THEMES } from "@/config/themes";
import { useThemeStore } from "@/stores/theme-store";
import { cn } from "@/lib/utils";

/** Full theme picker — used on the Settings page. */
export function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {THEMES.map((preset) => {
        const active = theme === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => setTheme(preset.id)}
            aria-pressed={active}
            className={cn(
              "glass pressable relative flex flex-col gap-3 p-4 text-left",
              active && "ring-2 ring-primary",
            )}
          >
            <div className="flex gap-1.5">
              {preset.swatch.map((c, i) => (
                <span
                  key={i}
                  className="h-7 w-7 rounded-full border border-white/10"
                  style={{ background: c }}
                />
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold">{preset.label}</p>
              <p className="text-xs text-muted">{preset.description}</p>
            </div>
            {active && (
              <Check className="absolute right-3 top-3 h-4 w-4 text-primary" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
