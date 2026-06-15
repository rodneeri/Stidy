"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { staggerChild, staggerParent } from "@/lib/motion";

/**
 * Container whose children cascade in. Wrap a list/grid in <Stagger> and each
 * direct <StaggerItem> in ~40ms apart. Combine with AnimatePresence to also get
 * exit animations on delete (neighbours slide to fill via `layout`).
 */
export function Stagger({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" {...props}>
      {children}
    </motion.div>
  );
}

/** A single cascading item. Set `layout` so siblings reflow smoothly on removal. */
export function StaggerItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div layout variants={staggerChild} exit="exit" {...props}>
      {children}
    </motion.div>
  );
}
