"use client";

import { motion } from "framer-motion";

/**
 * Sidy — STiDY's study buddy mascot. A friendly rounded character with a
 * graduation cap, used in onboarding and (later) as the AI assistant's face.
 * Pure SVG so it scales crisply and themes via the brand palette.
 */
export function Mascot({
  size = 96,
  animate = true,
  className,
}: {
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      style={{ width: size, height: size }}
      animate={animate ? { y: [0, -6, 0] } : undefined}
      transition={animate ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <svg viewBox="0 0 120 120" width="100%" height="100%" fill="none" aria-hidden>
        <defs>
          <linearGradient id="sidyBody" x1="20" y1="20" x2="100" y2="110" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8B6CFF" />
            <stop offset="1" stopColor="#6D49F5" />
          </linearGradient>
          <radialGradient id="sidyCheek" cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="#FF8FB1" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FF8FB1" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* soft shadow */}
        <ellipse cx="60" cy="110" rx="30" ry="6" fill="#000" opacity="0.12" />

        {/* body */}
        <rect x="22" y="34" width="76" height="72" rx="30" fill="url(#sidyBody)" />

        {/* face plate */}
        <rect x="33" y="50" width="54" height="40" rx="20" fill="#fff" opacity="0.96" />

        {/* eyes */}
        <motion.g
          animate={{ scaleY: [1, 1, 0.1, 1] }}
          transition={{ duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity }}
          style={{ transformOrigin: "60px 66px" }}
        >
          <circle cx="50" cy="66" r="5.5" fill="#2B2350" />
          <circle cx="70" cy="66" r="5.5" fill="#2B2350" />
          <circle cx="52" cy="64" r="1.8" fill="#fff" />
          <circle cx="72" cy="64" r="1.8" fill="#fff" />
        </motion.g>

        {/* cheeks */}
        <circle cx="42" cy="76" r="6" fill="url(#sidyCheek)" />
        <circle cx="78" cy="76" r="6" fill="url(#sidyCheek)" />

        {/* smile */}
        <path d="M52 78 Q60 85 68 78" stroke="#2B2350" strokeWidth="2.6" strokeLinecap="round" />

        {/* graduation cap */}
        <path d="M60 14 L96 28 L60 42 L24 28 Z" fill="#2B2350" />
        <path d="M60 42 L60 42 C72 42 82 38 82 34 L82 30 L60 38 L38 30 L38 34 C38 38 48 42 60 42 Z" fill="#3A2F66" />
        <circle cx="96" cy="28" r="2.4" fill="#FFD36E" />
        <path d="M96 28 L96 40" stroke="#FFD36E" strokeWidth="2" strokeLinecap="round" />
        <circle cx="96" cy="41" r="2.6" fill="#FFD36E" />
      </svg>
    </motion.div>
  );
}
