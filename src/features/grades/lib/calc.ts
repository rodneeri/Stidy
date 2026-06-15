import type { Category, Grade } from "@/types/db";

/**
 * Pure Grade-Engine math — mirrors the SQL `stidy_subject_grade` function so the
 * UI can run What-If / Target-Solver optimistically before the DB recomputes.
 */

/** Average of a category's graded items as a percentage, dropping the N lowest. */
export function categoryAverage(
  cat: Category,
  grades: Grade[],
  includeProjected = false,
): number | null {
  // A direct category grade overrides item-by-item scoring.
  if (cat.grade != null) return cat.grade;

  const items = grades.filter(
    (g) =>
      g.category_id === cat.id &&
      g.score != null &&
      (includeProjected || !g.is_projected),
  );
  if (items.length === 0) return null;

  // Each item carries a percentage and an in-category weight (default 1 = equal).
  const enriched = items
    .map((g) => ({
      pct: (g.score! / (g.max_score || 1)) * 100,
      weight: g.weight ?? 1,
    }))
    .sort((a, b) => a.pct - b.pct);

  const kept = enriched.slice(cat.drop_lowest ?? 0);
  const weightSum = kept.reduce((s, i) => s + i.weight, 0);
  if (kept.length === 0 || weightSum === 0) return null;

  // Weighted average within the category (normalised over present items).
  return kept.reduce((s, i) => s + i.pct * i.weight, 0) / weightSum;
}

/** Current weighted grade (0–100), normalised over categories that have grades. */
export function weightedGrade(
  categories: Category[],
  grades: Grade[],
  includeProjected = false,
): number | null {
  let weighted = 0;
  let weightSum = 0;
  for (const cat of categories) {
    if (cat.weight <= 0) continue;
    const avg = categoryAverage(cat, grades, includeProjected);
    if (avg == null) continue;
    weighted += avg * cat.weight;
    weightSum += cat.weight;
  }
  return weightSum === 0 ? null : weighted / weightSum;
}

export function totalWeight(categories: Category[]): number {
  return categories.reduce((s, c) => s + (c.weight || 0), 0);
}

/** Σ(avg·weight) and the total weight of categories that already have grades. */
function gradedParts(categories: Category[], grades: Grade[]) {
  let contribution = 0;
  let weight = 0;
  for (const cat of categories) {
    if (cat.weight <= 0) continue;
    const avg = categoryAverage(cat, grades, false);
    if (avg == null) continue;
    contribution += avg * cat.weight;
    weight += cat.weight;
  }
  return { contribution, weight };
}

/** Projected final grade if you score `x`% across all remaining (ungraded) weight. */
export function projectedFinal(
  categories: Category[],
  grades: Grade[],
  x: number,
): number | null {
  const total = totalWeight(categories);
  if (total <= 0) return null;
  const { contribution, weight } = gradedParts(categories, grades);
  const remaining = total - weight;
  return (contribution + x * remaining) / total;
}

/** Target Solver: score needed on remaining weight to reach `target` final grade. */
export function neededOnRemaining(
  categories: Category[],
  grades: Grade[],
  target: number,
): { needed: number | null; remainingWeight: number; lockedFinal: number | null } {
  const total = totalWeight(categories);
  const { contribution, weight } = gradedParts(categories, grades);
  const remaining = total - weight;

  if (remaining <= 0) {
    // Nothing left to grade — the final is locked in.
    return { needed: null, remainingWeight: 0, lockedFinal: total ? contribution / total : null };
  }
  const needed = (target * total - contribution) / remaining;
  return { needed, remainingWeight: remaining, lockedFinal: null };
}
