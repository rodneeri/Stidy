"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { dur, easeOut } from "@/lib/motion";

interface FadeInProps extends HTMLMotionProps<"div"> {
  delay?: number;
}

/** Fade + rise entrance. Honour reduced-motion via the global CSS killswitch. */
export function FadeIn({ delay = 0, children, ...props }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, delay, ease: easeOut }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
