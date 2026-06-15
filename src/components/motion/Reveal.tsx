"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { reveal } from "@/lib/motion";

/**
 * Scroll-triggered section reveal. Wrap a block (hero, feature row, stat panel)
 * and it "develops" into focus — rise + de-blur — the first time it scrolls into
 * view. Fires once; reduced-motion is neutralised by the global CSS killswitch.
 *
 * The `margin` pulls the trigger 12% before the element fully enters so motion
 * resolves while the user is still scrolling toward it, never after.
 */
export function Reveal({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={reveal}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-12% 0px" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
