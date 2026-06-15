"use client";

import type { CSSProperties } from "react";

interface NeuSliderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Format the floating bubble label. */
  format?: (v: number) => string;
}

/**
 * Neumorphic range slider: a carved channel with an accent-gradient fill, a
 * raised thumb that presses on grab, and a value bubble that rides the thumb.
 */
export function NeuSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format,
}: NeuSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  // Status colour: red (low) → amber → green (high).
  const fill = `hsl(${Math.round(pct * 1.25)} 78% 47%)`;
  const cssVars = { "--val": `${pct}%`, "--fill": fill } as CSSProperties;

  return (
    <div className="relative pt-9" style={cssVars}>
      {/* floating value bubble that tracks the thumb (clamped to stay on-rail) */}
      <div
        className="pointer-events-none absolute top-0 -translate-x-1/2 transition-[left] duration-75 ease-out"
        style={{ left: "clamp(1.5rem, var(--val), calc(100% - 1.5rem))" }}
      >
        <span
          className="neu inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tabular-nums"
          style={{ color: fill }}
        >
          {format ? format(value) : value}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="neu-range"
        style={cssVars}
      />
    </div>
  );
}
