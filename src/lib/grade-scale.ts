import { create } from "zustand";

export type GradeScale = "percent" | "ten" | "letter" | "gpa";
export const SCALE_KEY = "stidy-grade-scale";

export const SCALE_OPTIONS = [
  { value: "percent", label: "Percent (0–100)" },
  { value: "ten", label: "Out of 10" },
  { value: "letter", label: "Letter (A–F)" },
  { value: "gpa", label: "GPA (4.0)" },
];

interface ScaleState {
  scale: GradeScale;
  setScale: (s: GradeScale) => void;
}

export const useGradeScale = create<ScaleState>((set) => ({
  scale: "percent",
  setScale: (scale) => {
    try {
      localStorage.setItem(SCALE_KEY, scale);
    } catch {
      /* ignore */
    }
    set({ scale });
  },
}));

function letter(pct: number): string {
  if (pct >= 97) return "A+";
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 67) return "D+";
  if (pct >= 63) return "D";
  if (pct >= 60) return "D-";
  return "F";
}
function gpa(pct: number): number {
  if (pct >= 93) return 4.0;
  if (pct >= 90) return 3.7;
  if (pct >= 87) return 3.3;
  if (pct >= 83) return 3.0;
  if (pct >= 80) return 2.7;
  if (pct >= 77) return 2.3;
  if (pct >= 73) return 2.0;
  if (pct >= 70) return 1.7;
  if (pct >= 67) return 1.3;
  if (pct >= 63) return 1.0;
  if (pct >= 60) return 0.7;
  return 0.0;
}

/** Format a 0–100 percentage in the chosen grading scale. */
export function formatGrade(
  pct: number | null,
  scale: GradeScale,
  opts?: { suffix?: boolean; decimals?: number },
): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  const suffix = opts?.suffix ?? true;
  const dec = opts?.decimals ?? 1;
  switch (scale) {
    case "ten":
      return (pct / 10).toFixed(dec);
    case "gpa":
      return gpa(pct).toFixed(1) + (suffix ? " GPA" : "");
    case "letter":
      return letter(pct);
    default:
      return pct.toFixed(dec) + (suffix ? "%" : "");
  }
}
