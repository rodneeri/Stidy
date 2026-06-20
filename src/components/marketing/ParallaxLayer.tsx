"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

interface ParallaxLayerProps {
  children: React.ReactNode;
  /** Vertical drift in px as the layer scrolls through the viewport. Positive = moves down slower (background feel). */
  speed?: number;
  className?: string;
}

/**
 * Wraps content in a scroll-linked vertical drift, tracking the element's own
 * progress through the viewport (not document scroll) so it works anywhere
 * on the page. Disabled entirely under prefers-reduced-motion.
 */
export function ParallaxLayer({ children, speed = 40, className }: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y: MotionValue<number> = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [speed, -speed]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
