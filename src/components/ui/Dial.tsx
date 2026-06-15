"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useInView } from "framer-motion";
import { cn } from "@/lib/utils";

/** Count a number up from 0 once it scrolls into view (easeOutCubic). */
export function CountUp({
  to,
  duration = 1.2,
  decimals = 0,
}: {
  to: number;
  duration?: number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(eased * to);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setN(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return <span ref={ref}>{n.toFixed(decimals)}</span>;
}

/**
 * Skeuomorphic radial gauge. A carved channel holds a glowing accent fill that
 * sweeps on (CSS-interpolated via the registered --dial-p), with a raised
 * convex cap in the middle. The arc + the optional count-up fire the first
 * time the dial scrolls into view.
 */
export function Dial({
  value,
  size = 120,
  stroke = 12,
  accent,
  center,
  className,
}: {
  /** 0–100 fill percentage. */
  value: number;
  size?: number;
  stroke?: number;
  /** Override the accent fill/glow colour (any CSS color). Defaults to primary. */
  accent?: string;
  center?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const pct = Math.max(0, Math.min(value, 100));
  const cap = size - stroke * 2 - 8;

  return (
    <div ref={ref} className={cn("dial", className)} style={{ width: size, height: size }}>
      <div
        className="dial__fill"
        style={
          {
            "--dial-stroke": `${stroke}px`,
            "--dial-p": inView ? pct : 0,
            ...(accent ? { "--dial-accent": accent } : {}),
          } as CSSProperties
        }
      />
      <div className="dial__cap" style={{ width: cap, height: cap }}>
        {center ?? (
          <span
            className="text-2xl font-semibold"
            data-numeric
            style={{ fontFamily: "var(--font-display)" }}
          >
            <CountUp to={pct} />
            <span className="text-sm text-muted">%</span>
          </span>
        )}
      </div>
    </div>
  );
}
