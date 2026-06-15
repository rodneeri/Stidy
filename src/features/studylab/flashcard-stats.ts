"use client";

/** Lightweight, migration-free flashcard review stats (localStorage). */
export interface FcStats {
  reviews: number;
  good: number;
  easy: number;
  again: number;
  byDay: Record<string, number>;
}

const KEY = "stidy-fc-stats";
const empty: FcStats = { reviews: 0, good: 0, easy: 0, again: 0, byDay: {} };
const today = () => new Date().toISOString().slice(0, 10);

export function loadFcStats(): FcStats {
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...empty };
  }
}

export function recordReview(quality: "again" | "good" | "easy"): FcStats {
  const s = loadFcStats();
  s.reviews += 1;
  s[quality] += 1;
  s.byDay[today()] = (s.byDay[today()] ?? 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return s;
}

export const todayReviews = (s: FcStats) => s.byDay[today()] ?? 0;
export const accuracy = (s: FcStats) => (s.reviews ? Math.round(((s.good + s.easy) / s.reviews) * 100) : 0);

/** Current daily review streak (consecutive days up to today with ≥1 review). */
export function streak(s: FcStats): number {
  let n = 0;
  const d = new Date();
  // allow today to be empty without breaking yesterday's streak
  if (!s.byDay[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
  for (;;) {
    if (s.byDay[d.toISOString().slice(0, 10)]) {
      n += 1;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return n;
}
