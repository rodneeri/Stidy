"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into <body>, escaping any transformed/`will-change` ancestor.
 * Needed for `position: fixed` overlays inside the PageTransition wrapper, whose
 * transform context would otherwise anchor them to the centered content column
 * instead of the viewport. SSR-safe (mounts client-side only).
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
