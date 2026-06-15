"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

/** Neumorphic switch — carved track, raised physical knob that slides with a spring. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "neu-inset relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked && "bg-[hsl(var(--primary)/0.18)]",
      )}
    >
      <span
        className={cn(
          "neu absolute top-1 h-5 w-5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          checked ? "left-6 bg-gradient-to-br from-primary to-secondary" : "left-1",
        )}
      />
    </button>
  );
}
