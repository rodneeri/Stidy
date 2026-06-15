"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { THEMES } from "@/config/themes";
import { useThemeStore } from "@/stores/theme-store";
import { cn } from "@/lib/utils";

/** Palette button that opens a rounded popover of circular theme swatches. */
export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose theme"
        aria-expanded={open}
        className="neu-btn grid h-9 w-9 place-items-center rounded-full"
      >
        <Palette className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -8 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="neu absolute right-0 top-12 z-30 rounded-full p-2.5"
          >
            <div className="flex items-center gap-2.5">
              {THEMES.map((t, i) => {
                const active = theme === t.id;
                return (
                  <motion.button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTheme(t.id);
                      setOpen(false);
                    }}
                    title={t.label}
                    aria-label={t.label}
                    aria-pressed={active}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04, type: "spring", stiffness: 400, damping: 20 }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.82, boxShadow: "inset 0 4px 9px rgba(0,0,0,0.35)" }}
                    className={cn(
                      "relative grid h-10 w-10 place-items-center rounded-full shadow-md ring-offset-2 ring-offset-[hsl(var(--surface))]",
                      active && "ring-2 ring-primary",
                    )}
                    style={{
                      background: `linear-gradient(145deg, ${t.swatch[0]}, ${t.swatch[1]} 50%, ${t.swatch[2]})`,
                    }}
                  >
                    {active && (
                      <Check className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
