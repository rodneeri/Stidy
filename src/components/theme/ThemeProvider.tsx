"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/config/themes";
import { useThemeStore } from "@/stores/theme-store";
import { useGradeScale, SCALE_KEY, type GradeScale } from "@/lib/grade-scale";

/**
 * Keeps the active theme authoritative and stable across navigation.
 *
 * On mount it adopts the persisted theme (the value the pre-paint boot script
 * already applied to <html>), then on every route change it re-asserts that
 * value onto <html data-theme>. The re-assertion fixes a bug where navigating
 * via the sidebar logo could momentarily revert <html> to the server-rendered
 * DEFAULT_THEME, snapping the user's chosen theme back to default.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    let initial = document.documentElement.dataset.theme as ThemeId | undefined;
    try {
      initial =
        (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null) ??
        initial ??
        undefined;
      const saved = localStorage.getItem(SCALE_KEY) as GradeScale | null;
      if (saved) useGradeScale.setState({ scale: saved });
    } catch {
      /* storage unavailable (private mode) — non-fatal */
    }
    const resolved = initial ?? DEFAULT_THEME;
    // Re-apply to <html> too: after a full reload (e.g. a renderer crash) the
    // pre-paint boot script may not have restored it, so do it here as well.
    document.documentElement.dataset.theme = resolved;
    useThemeStore.setState({ theme: resolved });
  }, []);

  // Re-apply on each navigation so nothing can leave us on the default theme.
  useEffect(() => {
    const active = useThemeStore.getState().theme;
    if (document.documentElement.dataset.theme !== active) {
      document.documentElement.dataset.theme = active;
    }
  }, [pathname]);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
