"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { DEFAULT_THEME, type ThemeId } from "@/config/themes";
import { useThemeStore } from "@/stores/theme-store";
import { useGradeScale, SCALE_KEY, type GradeScale } from "@/lib/grade-scale";

/**
 * Syncs the Zustand store with whatever theme the pre-paint boot script applied
 * to <html>. Keeps client state authoritative after hydration without causing a
 * mismatch (the DOM attribute is already correct on mount).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme as ThemeId | undefined;
    useThemeStore.setState({ theme: fromDom ?? DEFAULT_THEME });
    try {
      const saved = localStorage.getItem(SCALE_KEY) as GradeScale | null;
      if (saved) useGradeScale.setState({ scale: saved });
    } catch {
      /* ignore */
    }
  }, []);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
