"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Palette } from "lucide-react";
import { THEMES } from "@/config/themes";
import { useThemeStore } from "@/stores/theme-store";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

/**
 * Appearance as a collapsible drawer: closed, it just shows the active theme
 * (label + swatches); open, it reveals the full theme grid.
 */
export function AppearanceSetting() {
  const themeId = useThemeStore((s) => s.theme);
  const current = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="pressable flex w-full items-center gap-3 rounded-xl py-1 text-left"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Palette className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Appearance</p>
          <p className="text-sm text-muted">
            Theme · <span className="text-foreground">{current.label}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {current.swatch.slice(0, 2).map((c, i) => (
            <span
              key={i}
              className="h-5 w-5 rounded-full border border-white/10"
              style={{ background: c }}
            />
          ))}
          <ChevronDown
            className={`h-5 w-5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="mb-3 mt-4 text-sm text-muted">
              Pick a theme preset. Your choice is saved to this device.
            </p>
            <ThemeSwitcher />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
