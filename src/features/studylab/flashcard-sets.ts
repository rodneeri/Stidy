"use client";

/**
 * Flashcard "sets" — a named grouping of generated flashcards, plus
 * lightweight completion stats (times completed, average score).
 *
 * TODO(schema): the `flashcards` table has no `set_id` / set-name column
 * (see supabase/schema.sql), so sets are modeled client-side, mirroring the
 * existing per-subject SavedExam pattern in StudyLab.tsx. If/when a real
 * `flashcard_sets` table + `flashcards.set_id` column is added, this module
 * can be swapped for Supabase-backed reads/writes without changing the
 * FcSet shape consumed by the UI.
 */
export interface FcSet {
  id: string;
  name: string;
  /** IDs of flashcard rows (in the `flashcards` table) that belong to this set. */
  cardIds: string[];
  difficulty: "easy" | "medium" | "hard";
  createdAt: number;
  /** Number of full review sessions completed for this set. */
  completions: number;
  /** Sum of per-session accuracy (0-100) across all completions, for averaging. */
  scoreSum: number;
}

const key = (subjectId: string) => `stidy-fc-sets-${subjectId}`;

export function loadSets(subjectId: string): FcSet[] {
  try {
    return JSON.parse(localStorage.getItem(key(subjectId)) || "[]");
  } catch {
    return [];
  }
}

function saveSets(subjectId: string, sets: FcSet[]) {
  try {
    localStorage.setItem(key(subjectId), JSON.stringify(sets));
  } catch {
    /* ignore */
  }
}

export function createSet(
  subjectId: string,
  name: string,
  cardIds: string[],
  difficulty: FcSet["difficulty"],
): FcSet {
  const set: FcSet = {
    id: crypto.randomUUID(),
    name,
    cardIds,
    difficulty,
    createdAt: Date.now(),
    completions: 0,
    scoreSum: 0,
  };
  saveSets(subjectId, [set, ...loadSets(subjectId)]);
  return set;
}

export function renameSet(subjectId: string, setId: string, name: string): FcSet[] {
  const next = loadSets(subjectId).map((s) => (s.id === setId ? { ...s, name } : s));
  saveSets(subjectId, next);
  return next;
}

export function deleteSet(subjectId: string, setId: string): FcSet[] {
  const next = loadSets(subjectId).filter((s) => s.id !== setId);
  saveSets(subjectId, next);
  return next;
}

/** Record one completed review session (accuracy 0-100) for a set. */
export function recordSetCompletion(subjectId: string, setId: string, accuracyPct: number): FcSet[] {
  const next = loadSets(subjectId).map((s) =>
    s.id === setId ? { ...s, completions: s.completions + 1, scoreSum: s.scoreSum + accuracyPct } : s,
  );
  saveSets(subjectId, next);
  return next;
}

export const avgScore = (s: FcSet) => (s.completions ? Math.round(s.scoreSum / s.completions) : null);

/** Drop card IDs from every set in a subject (e.g. after deleting a card). */
export function pruneCardId(subjectId: string, cardId: string): FcSet[] {
  const next = loadSets(subjectId).map((s) => ({ ...s, cardIds: s.cardIds.filter((id) => id !== cardId) }));
  saveSets(subjectId, next);
  return next;
}
