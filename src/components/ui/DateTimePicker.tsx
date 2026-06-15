"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const pad = (n: number) => n.toString().padStart(2, "0");
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parse(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function toValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  value: string; // "YYYY-MM-DDTHH:mm" or ""
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  up?: boolean;
}

/** Themed date + time picker — glass popover calendar, no native browser UI. */
export function DateTimePicker({ value, onChange, placeholder = "Pick date & time", className, up }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = parse(value);
  const [view, setView] = useState<Date>(sel ?? new Date());

  useEffect(() => {
    if (sel) setView((v) => (v.getMonth() === sel.getMonth() && v.getFullYear() === sel.getFullYear() ? v : sel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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

  const year = view.getFullYear();
  const month = view.getMonth();
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
  const isSel = (d: number) =>
    sel && sel.getFullYear() === year && sel.getMonth() === month && sel.getDate() === d;

  const setDay = (d: number) => {
    const nd = new Date(year, month, d, sel ? sel.getHours() : 9, sel ? sel.getMinutes() : 0);
    onChange(toValue(nd));
  };
  const setTime = (h: number, m: number) => {
    const base = sel ?? new Date(year, month, 1, 9, 0);
    const nd = new Date(base);
    nd.setHours(Math.max(0, Math.min(23, h)));
    nd.setMinutes(Math.max(0, Math.min(59, m)));
    onChange(toValue(nd));
  };

  const label = sel
    ? sel.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : placeholder;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted" />
        <span className={cn("truncate", !sel && "text-muted")}>{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: up ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: up ? 4 : -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={cn(
              "glass absolute z-50 w-72 origin-top space-y-3 p-3",
              up ? "bottom-full mb-1 origin-bottom" : "top-full mt-1",
            )}
          >
            {/* month nav */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView(new Date(year, month - 1, 1))}
                className="pressable grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-primary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">
                {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
              <button
                type="button"
                onClick={() => setView(new Date(year, month + 1, 1))}
                className="pressable grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-primary"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* weekdays */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted">
              {DOW.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            {/* days */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) =>
                d == null ? (
                  <span key={i} />
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDay(d)}
                    className={cn(
                      "pressable grid h-8 place-items-center rounded-lg text-sm tabular-nums",
                      isSel(d)
                        ? "neu text-primary"
                        : isToday(d)
                          ? "text-primary"
                          : "text-foreground hover:text-primary",
                    )}
                  >
                    {d}
                  </button>
                ),
              )}
            </div>

            {/* time */}
            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={sel ? pad(sel.getHours()) : "09"}
                  onChange={(e) => setTime(parseInt(e.target.value) || 0, sel?.getMinutes() ?? 0)}
                  className="field w-14 rounded-lg px-2 py-1.5 text-center text-sm tabular-nums outline-none"
                />
                <span className="font-semibold text-muted">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={sel ? pad(sel.getMinutes()) : "00"}
                  onChange={(e) => setTime(sel?.getHours() ?? 9, parseInt(e.target.value) || 0)}
                  className="field w-14 rounded-lg px-2 py-1.5 text-center text-sm tabular-nums outline-none"
                />
              </div>
              <div className="flex gap-2">
                {value && (
                  <button
                    type="button"
                    onClick={() => onChange("")}
                    className="pressable rounded-lg px-2 py-1 text-xs text-muted hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="pressable rounded-lg px-3 py-1 text-xs font-medium text-primary"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
