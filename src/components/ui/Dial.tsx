"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

/** Count an integer up from 0 once it scrolls into view (easeOutCubic). */
export function CountUp({
  to,
  duration = 1.1,
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
 * Animated radial progress dial. The accent arc draws on (with a soft glow) and
 * an optional centered label counts up the first time it enters the viewport.
 * One source of truth for every ring in the app — dashboard, grades, showcase.
 */
export function Dial({
  value,
  size = 120,
  stroke = 10,
  color = "hsl(var(--primary))",
  center,
  className,
}: {
  /** 0–100 fill percentage. */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  /** Centered content; defaults to the value counting up to `value%`. */
  center?: ReactNode;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(value, 100));

  return (
    <div
      className={className}
      style={{ position: "relative", width: size, height: size, display: "grid", placeItems: "center" }}
    >
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--neu-dark))"
          strokeWidth={stroke}
          opacity={0.5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={inView ? { strokeDashoffset: circ - (pct / 100) * circ } : {}}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute grid place-items-center text-center">
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
