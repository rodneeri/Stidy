"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED = [
  "📚", "📐", "📝", "🧪", "🔬", "💻", "🧮", "📊", "🌍", "🧬",
  "⚗️", "🩺", "⚖️", "🎨", "🎵", "🏛️", "💡", "🧠", "📖", "✏️",
  "🔢", "🌱", "⚙️", "🪐", "📈", "💰", "🗣️", "🩻", "🔭", "📡",
  "🎭", "🏗️", "⚛️", "🧲", "🌡️", "🧫", "🦴", "🧑‍⚕️", "👩‍🏫", "🏥",
];

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

/** Compact emoji/symbol picker — choose a suggestion or type your own. */
export function EmojiPicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field grid h-11 w-11 place-items-center rounded-xl text-xl"
        aria-label="Choose an icon"
      >
        {value || <Smile className="h-5 w-5 text-muted" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="glass absolute left-0 top-full z-50 mt-1 w-64 space-y-2 p-2"
          >
            <div className="flex items-center gap-2">
              <input
                value={value}
                onChange={(e) => onChange([...e.target.value].slice(-1).join(""))}
                placeholder="Type any emoji…"
                className="field w-full rounded-lg px-3 py-1.5 text-center text-sm outline-none"
              />
              {value && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="pressable grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:text-foreground"
                  aria-label="Clear icon"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {SUGGESTED.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onChange(e);
                    setOpen(false);
                  }}
                  className={cn(
                    "pressable grid h-7 w-7 place-items-center rounded-lg text-lg",
                    value === e && "neu",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
