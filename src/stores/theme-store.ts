import { create } from "zustand";
import { DEFAULT_THEME, THEME_STORAGE_KEY, type ThemeId } from "@/config/themes";

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

/**
 * Theme is the single source of truth for the active visual preset.
 * `setTheme` writes the `data-theme` attribute on <html> (which drives all the
 * CSS variables in globals.css) and persists to localStorage so the inline
 * boot script in the root layout can restore it before first paint (no FOUC).
 */
export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        /* storage unavailable (private mode) — non-fatal */
      }
    }
    set({ theme });
  },
}));
