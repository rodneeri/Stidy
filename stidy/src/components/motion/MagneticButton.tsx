"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

interface MagneticButtonProps extends React.ComponentProps<typeof motion.button> {
  /** How far the button drifts toward the cursor (px). */
  strength?: number;
}

/** A button that subtly follows the cursor, then springs back on leave. */
export function MagneticButton({
  strength = 18,
  className,
  children,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * strength;
    const y = ((e.clientY - r.top) / r.height - 0.5) * strength;
    setPos({ x, y });
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      whileTap={{ scale: 0.95 }}
      transition={spring.magnetic}
      className={cn(
        "neu-btn inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
