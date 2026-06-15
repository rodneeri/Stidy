"use client";

import { motion } from "framer-motion";
import { fadeRise } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Friendly placeholder for empty lists: fades up, with a gently floating icon
 * so a blank screen reads as intentional, not broken. The float loop is a
 * transform animation, so the global `reducedMotion="user"` MotionConfig stills
 * it for users who ask for reduced motion.
 */
export function EmptyState({ icon, title, children, className }: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeRise}
      initial="hidden"
      animate="show"
      className={cn("glass grid min-h-[260px] place-items-center p-6 text-center", className)}
    >
      <div className="space-y-2">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary"
        >
          {icon}
        </motion.div>
        <p className="font-medium">{title}</p>
        {children && <div className="mx-auto max-w-xs text-sm text-muted">{children}</div>}
      </div>
    </motion.div>
  );
}
