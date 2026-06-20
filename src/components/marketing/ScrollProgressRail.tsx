"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * Thin fixed progress bar pinned to the top of the viewport, scrubbed by
 * document scroll position. Gives the page the "scroll is doing something"
 * feel from equiduct.com without copying its visual style — just a slim
 * accent-colored hairline. Respects reduced-motion via a stiffer spring that
 * effectively tracks 1:1 (still skips translate3d jank, never disorienting).
 */
export function ScrollProgressRail() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 300, damping: 40, mass: 0.2 });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-[2.5px] origin-left bg-gradient-to-r from-primary via-secondary to-primary"
    />
  );
}
