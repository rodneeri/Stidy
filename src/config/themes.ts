export type ThemeId = "nexus" | "soft" | "soft-dark" | "cyber" | "metal";

export interface ThemePreset {
  id: ThemeId;
  label: string;
  description: string;
  /** Two-tone preview (accent, secondary) used by the round picker, + surface. */
  swatch: [string, string, string];
}

export const THEMES: ThemePreset[] = [
  {
    id: "nexus",
    label: "Nexus",
    description: "Warm amber relief",
    swatch: ["#ec8b2e", "#e8623a", "#ede3d8"],
  },
  {
    id: "soft",
    label: "Soft UI",
    description: "Cool blue relief",
    swatch: ["#2f86e8", "#2dbca8", "#dde6ec"],
  },
  {
    id: "soft-dark",
    label: "Soft Dark",
    description: "Dark cyan relief",
    swatch: ["#22c9e6", "#2ad2ae", "#23282e"],
  },
  {
    id: "cyber",
    label: "Cyber",
    description: "Neon green relief",
    swatch: ["#16e85a", "#8be62f", "#0e160e"],
  },
  {
    id: "metal",
    label: "Metal",
    description: "Brushed-aluminium instrument",
    swatch: ["#ff5a00", "#3a3f47", "#cfd2d6"],
  },
];

export const DEFAULT_THEME: ThemeId = "nexus";
export const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[];
export const THEME_STORAGE_KEY = "stidy-theme";
