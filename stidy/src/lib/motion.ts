import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion vocabulary for STiDY. One source of truth for easings,
 * durations, springs, and entrance variants so every transition feels like
 * the same physical system. Reduced-motion is handled globally in globals.css.
 */

/** Signature ease-out curve (used app-wide for fades/slides). */
export const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Canonical durations (seconds). */
export const dur = {
  fast: 0.18,
  base: 0.3,
  slow: 0.45,
} as const;

/** Named springs for layout/popover/magnetic motion. */
export const spring = {
  /** Popovers, modals, dropdowns — snappy with a touch of settle. */
  pop: { type: "spring", stiffness: 320, damping: 26 },
  /** Layout transitions, the sliding nav pill. */
  slide: { type: "spring", stiffness: 380, damping: 32 },
  /** Cursor-following buttons. */
  magnetic: { type: "spring", stiffness: 250, damping: 18, mass: 0.4 },
} satisfies Record<string, Transition>;

/** Fade + rise entrance (FadeIn, page-level). */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: easeOut } },
};

/** Parent that cascades its children in. Pair with {@link staggerChild}. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

/** Child of a {@link staggerParent}; also the per-item enter/exit for lists. */
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: easeOut } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: dur.fast, ease: easeOut } },
};

/**
 * Section-level reveal for scroll entrances — more travel + a brief blur so a
 * whole block "develops" into focus rather than just sliding. Pair with
 * `whileInView="show"` + `viewport={{ once: true, margin: "-12% 0px" }}`.
 */
export const reveal: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: dur.slow, ease: easeOut },
  },
};

/** Settle-in scale for cards/figures that should feel placed, not slid. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: spring.pop },
};
