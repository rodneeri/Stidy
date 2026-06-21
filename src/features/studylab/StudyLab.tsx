"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Loader2, Layers, Pencil, Check, Flame, Eye, EyeOff, ArrowLeft, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Flashcard } from "@/types/db";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { MathText } from "@/components/ui/MathText";
import { Dropdown } from "@/components/ui/Dropdown";
import { AI_MODELS } from "@/lib/ai/catalog";
import { useAiModel } from "@/lib/ai/useAiModel";
import { FlashcardStack } from "./FlashcardStack";
import { loadFcStats, recordReview, todayReviews, accuracy, streak, type FcStats } from "./flashcard-stats";
import {
  loadSets,
  createSet,
  renameSet,
  deleteSet,
  recordSetCompletion,
  pruneCardId,
  avgScore,
  type FcSet,
} from "./flashcard-sets";
import { useSubjectIcons } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { useErrorStore } from "@/stores/error-store";

const MODEL_OPTIONS = AI_MODELS.map((m) => ({ value: m.value, label: m.label }));

type GenType = "flashcards" | "written" | "practical" | "solver";
type Difficulty = "easy" | "medium" | "hard";
type ExamQ = { question: string; answer: string; points: number | null };
type SolutionStep = { heading: string | null; detail: string };
type Solution = { steps: SolutionStep[]; answer: string; problem: string };
type SavedSolution = Solution & { id: string; createdAt: number };
type SavedExam = {
  id: string;
  type: GenType;
  difficulty: Difficulty;
  createdAt: number;
  questions: ExamQ[];
  name?: string;
};

const examName = (e: SavedExam) =>
  e.name?.trim() || (e.type === "practical" ? "Practical exam" : "Written exam");

const examKey = (subjectId: string) => `stidy-exams-${subjectId}`;
function loadExamHistory(subjectId: string): SavedExam[] {
  try {
    return JSON.parse(localStorage.getItem(examKey(subjectId)) || "[]");
  } catch {
    return [];
  }
}
function saveExamHistory(subjectId: string, list: SavedExam[]) {
  try {
    localStorage.setItem(examKey(subjectId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const solnKey = (subjectId: string) => `stidy-solutions-${subjectId}`;
function loadSolutions(subjectId: string): SavedSolution[] {
  try {
    return JSON.parse(localStorage.getItem(solnKey(subjectId)) || "[]");
  } catch {
    return [];
  }
}
function saveSolutions(subjectId: string, list: SavedSolution[]) {
  try {
    localStorage.setItem(solnKey(subjectId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const TYPES: { id: GenType; label: string; hint: string }[] = [
  { id: "flashcards", label: "Flashcards", hint: "Q&A cards saved to a deck" },
  { id: "written", label: "Written Exam", hint: "Conceptual / short-answer" },
  { id: "practical", label: "Practical Exam", hint: "Problems with worked solutions" },
  { id: "solver", label: "Solver", hint: "Step-by-step solution to a problem" },
];
const DIFFS: Difficulty[] = ["easy", "medium", "hard"];
const DIFF_STYLE: Record<Difficulty, string> = {
  easy: "bg-success/15 text-success",
  medium: "bg-warning/15 text-warning",
  hard: "bg-danger/15 text-danger",
};
const field = "field w-full rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted";

export function StudyLab({ initialSubject = null }: { initialSubject?: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [sets, setSets] = useState<FcSet[]>([]);
  const [openSetId, setOpenSetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialog, setDialog] = useState(false);
  const [opts, setOpts] = useState<{ type: GenType; difficulty: Difficulty; count: number; prompt: string; problem: string }>({
    type: "flashcards",
    difficulty: "medium",
    count: 8,
    prompt: "",
    problem: "",
  });
  const [solution, setSolution] = useState<Solution | null>(null);
  const [solutions, setSolutions] = useState<SavedSolution[]>([]);
  const [subjectResources, setSubjectResources] = useState<{ id: string; title: string; kind: string }[]>([]);
  const [pickedResources, setPickedResources] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [model, setModel] = useAiModel();
  const [openExam, setOpenExam] = useState<SavedExam | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<SavedExam[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renamingSetId, setRenamingSetId] = useState<string | null>(null);
  const [setNameDraft, setSetNameDraft] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<Flashcard[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAns, setShowAns] = useState(false);
  const [reviewGood, setReviewGood] = useState(0);
  const [fcStats, setFcStats] = useState<FcStats | null>(null);
  const icons = useSubjectIcons();
  const reviewSetId = useRef<string | null>(null);

  async function loadCards(id: string) {
    const { data } = await supabase
      .from("flashcards")
      .select("*")
      .eq("subject_id", id)
      .order("created_at", { ascending: false });
    setCards((data as Flashcard[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase
        .from("subjects")
        .select("id, name, color")
        .is("parent_id", null)
        .order("name");
      const list = (data as { id: string; name: string; color: string | null }[]) ?? [];
      setSubjects(list);
      const preferred = initialSubject && list.some((s) => s.id === initialSubject) ? initialSubject : list[0]?.id;
      if (preferred) setSelectedId(preferred);
      setFcStats(loadFcStats());
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Reset per-subject local view state when the selected subject changes.
  // Derived during render (guarded by state, not an effect) for the
  // synchronous resets; `loadCards` stays in an effect since it's an async
  // fetch from Supabase (a genuine external-system sync).
  const [loadedForSubject, setLoadedForSubject] = useState<string | null>(null);
  if (selectedId && loadedForSubject !== selectedId) {
    setLoadedForSubject(selectedId);
    setOpenExam(null);
    setHistory(loadExamHistory(selectedId));
    setSets(loadSets(selectedId));
    setOpenSetId(null);
    setSolutions(loadSolutions(selectedId));
    setPickedResources([]);
  }

  useEffect(() => {
    // loadCards is an async Supabase fetch (a genuine external-system sync);
    // its setCards call happens after an await, but the lint rule flags the
    // call site itself since it can't see through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedId) loadCards(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // The subject's filed resources — for the "Materials to use" picker so the
  // student can narrow what grounds the AI (default: all of them).
  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      const { data } = await supabase
        .from("resources")
        .select("id, title, kind")
        .eq("subject_id", selectedId)
        .order("created_at", { ascending: false });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubjectResources((data as { id: string; title: string; kind: string }[]) ?? []);
    })();
  }, [selectedId, supabase]);

  async function generate() {
    if (!selectedId || !userId) return;
    setGenerating(true);
    setError(null);
    try {
      type GenResult = {
        type: string;
        cards?: { front: string; back: string }[];
        questions?: ExamQ[];
        steps?: SolutionStep[];
        answer?: string;
      };
      const json = await apiFetch<GenResult>(
        "/api/study/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectId: selectedId,
            type: opts.type,
            difficulty: opts.difficulty,
            count: opts.count,
            customPrompt: opts.prompt,
            problem: opts.problem,
            resourceIds: pickedResources.length ? pickedResources : undefined,
            model,
          }),
        },
        { title: "Couldn't generate your study set" },
      );
      if (json.type === "solver") {
        const sol: SavedSolution = {
          id: crypto.randomUUID(),
          problem: opts.problem.trim(),
          steps: json.steps ?? [],
          answer: json.answer ?? "",
          createdAt: Date.now(),
        };
        if (selectedId) {
          const next = [sol, ...loadSolutions(selectedId)].slice(0, 20);
          saveSolutions(selectedId, next);
          setSolutions(next);
        }
        setSolution(sol);
      } else if (json.type === "flashcards") {
        const rows = (json.cards as { front: string; back: string }[]).map((c) => ({
          user_id: userId,
          subject_id: selectedId,
          front: c.front,
          back: c.back,
          source: "ai_generated",
        }));
        const { data: inserted } = await supabase.from("flashcards").insert(rows).select("id");
        const ids = ((inserted as { id: string }[] | null) ?? []).map((r) => r.id);
        if (ids.length) {
          const subjectName = subjects.find((s) => s.id === selectedId)?.name ?? "Set";
          const ordinal = loadSets(selectedId).length + 1;
          const name = opts.prompt.trim() ? opts.prompt.trim().slice(0, 40) : `${subjectName} set ${ordinal}`;
          createSet(selectedId, name, ids, opts.difficulty);
          setSets(loadSets(selectedId));
        }
        await loadCards(selectedId);
      } else {
        const qs = json.questions as ExamQ[];
        const entry: SavedExam = {
          id: crypto.randomUUID(),
          type: opts.type,
          difficulty: opts.difficulty,
          createdAt: Date.now(),
          questions: qs,
        };
        const next = [entry, ...loadExamHistory(selectedId)].slice(0, 20);
        saveExamHistory(selectedId, next);
        setHistory(next);
        setRevealed(new Set());
        setOpenExam(entry); // open it on its own immediately
      }
      setDialog(false);
    } catch (err) {
      useErrorStore.getState().report(err, "Study Lab · generate");
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function deleteCard(id: string) {
    await supabase.from("flashcards").delete().eq("id", id);
    if (selectedId) {
      await loadCards(selectedId);
      setSets(pruneCardId(selectedId, id));
    }
  }

  const UNSORTED = "unsorted";
  const setCardIds = new Set(sets.flatMap((s) => s.cardIds));
  const unsortedCards = cards.filter((c) => !setCardIds.has(c.id));
  const activeSet = openSetId === UNSORTED ? null : sets.find((s) => s.id === openSetId) ?? null;
  const visibleCards = openSetId
    ? openSetId === UNSORTED
      ? unsortedCards
      : cards.filter((c) => activeSet?.cardIds.includes(c.id))
    : cards;

  function startReview() {
    const today = new Date().toISOString().slice(0, 10);
    const due = visibleCards.filter((c) => !c.due_date || c.due_date <= today);
    if (due.length === 0) return;
    reviewSetId.current = openSetId;
    setReviewQueue(due);
    setReviewIdx(0);
    setShowAns(false);
    setReviewGood(0);
    setReviewing(true);
  }

  async function gradeCard(card: Flashcard, quality: "again" | "good" | "easy") {
    let ease = card.ease_factor ?? 2.5;
    let reps = card.repetitions ?? 0;
    let interval = card.interval_days ?? 0;
    if (quality === "again") {
      reps = 0;
      interval = 0;
      ease = Math.max(1.3, ease - 0.2);
    } else {
      reps += 1;
      if (quality === "easy") ease += 0.15;
      if (reps === 1) interval = quality === "easy" ? 3 : 1;
      else if (reps === 2) interval = quality === "easy" ? 6 : 3;
      else interval = Math.round(interval * ease * (quality === "easy" ? 1.3 : 1));
    }
    const due = new Date();
    due.setDate(due.getDate() + interval);
    await supabase
      .from("flashcards")
      .update({
        ease_factor: ease,
        repetitions: reps,
        interval_days: interval,
        due_date: due.toISOString().slice(0, 10),
      })
      .eq("id", card.id);

    setFcStats(recordReview(quality));
    const good = quality !== "again";

    if (reviewIdx + 1 < reviewQueue.length) {
      setReviewGood((g) => g + (good ? 1 : 0));
      setReviewIdx(reviewIdx + 1);
      setShowAns(false);
    } else {
      const finalGood = reviewGood + (good ? 1 : 0);
      const pct = Math.round((finalGood / reviewQueue.length) * 100);
      if (selectedId && reviewSetId.current && reviewSetId.current !== UNSORTED) {
        setSets(recordSetCompletion(selectedId, reviewSetId.current, pct));
      }
      setReviewing(false);
      if (selectedId) await loadCards(selectedId);
    }
  }

  function reopenExam(e: SavedExam) {
    setRevealed(new Set());
    setOpenExam(e);
  }
  function deleteExam(id: string) {
    if (!selectedId) return;
    const next = history.filter((h) => h.id !== id);
    saveExamHistory(selectedId, next);
    setHistory(next);
    setOpenExam((cur) => (cur?.id === id ? null : cur));
  }
  function renameExam(id: string, name: string) {
    if (!selectedId) return;
    const next = history.map((h) => (h.id === id ? { ...h, name } : h));
    saveExamHistory(selectedId, next);
    setHistory(next);
    setOpenExam((cur) => (cur?.id === id ? { ...cur, name } : cur));
    setRenamingId(null);
  }

  function doRenameSet(setId: string, name: string) {
    if (!selectedId || !name.trim()) {
      setRenamingSetId(null);
      return;
    }
    setSets(renameSet(selectedId, setId, name.trim()));
    setRenamingSetId(null);
  }
  async function doDeleteSet(setId: string) {
    if (!selectedId) return;
    setSets(deleteSet(selectedId, setId));
    if (openSetId === setId) setOpenSetId(null);
    // Deleting a set is a grouping-only action — the underlying cards stay,
    // and fall back into "Unsorted" automatically since they're no longer
    // referenced by any set's cardIds.
  }

  async function updateCard(id: string, front: string, back: string) {
    await supabase.from("flashcards").update({ front, back }).eq("id", id);
    if (selectedId) await loadCards(selectedId);
  }
  async function deleteAllCards() {
    if (!selectedId) return;
    await supabase.from("flashcards").delete().eq("subject_id", selectedId);
    await loadCards(selectedId);
    setSets(loadSets(selectedId).map((s) => ({ ...s, cardIds: [] })));
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueCount = visibleCards.filter((c) => !c.due_date || c.due_date <= todayStr).length;

  if (loading) return <div className="skeleton h-72 w-full" />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display-3">Study <span className="text-gradient">Lab</span></h1>
          <p className="mt-1 text-sm text-muted">
            Generate flashcards and exams from a subject — tuned to difficulty and your prompt.
          </p>
        </div>
        {selectedId && (
          <button
            onClick={() => setDialog(true)}
            className="neu-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
          >
            <Sparkles className="h-4 w-4" /> Generate
          </button>
        )}
      </header>

      {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

      {subjects.length === 0 ? (
        <div className="glass grid min-h-[220px] place-items-center p-6 text-center">
          <div className="space-y-2">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Layers className="h-6 w-6" />
            </div>
            <p className="font-medium">Add a subject first</p>
            <p className="mx-auto max-w-xs text-sm text-muted">
              The Study Lab generates from a subject and its materials. Create one in Subjects.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Subject pills */}
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "pressable flex items-center gap-2 rounded-full px-3 py-1.5 text-sm",
                  selectedId === s.id ? "neu text-primary" : "text-muted hover:text-foreground",
                )}
              >
                {icons[s.id] ? (
                  <span className="text-base leading-none">{icons[s.id]}</span>
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color ?? "#14b8a6" }} />
                )}
                {s.name}
              </button>
            ))}
          </div>

          {/* Saved exams (persisted per-subject in localStorage) */}
          {history.length > 0 && (
            <div className="glass space-y-2 p-5">
              <h2 className="font-semibold">Saved exams</h2>
              <div className="space-y-1">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-1">
                    {renamingId === h.id ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameExam(h.id, renameDraft);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onBlur={() => renameExam(h.id, renameDraft)}
                        placeholder={examName(h)}
                        className="field flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => reopenExam(h)}
                        className="pressable flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:text-primary"
                      >
                        <span className="truncate">
                          {examName(h)} · {h.difficulty} · {h.questions.length} Q
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {new Date(h.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setRenameDraft(h.name ?? "");
                        setRenamingId(renamingId === h.id ? null : h.id);
                      }}
                      aria-label="Rename exam"
                      className="pressable grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:text-primary"
                    >
                      {renamingId === h.id ? <Check className="h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
                    </button>
                    <ConfirmDelete label="Delete saved exam" onConfirm={() => deleteExam(h.id)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved solutions (Solver history, per-subject) */}
          {solutions.length > 0 && (
            <div className="glass space-y-2 p-5">
              <h2 className="font-semibold">Saved solutions</h2>
              <div className="space-y-1">
                {solutions.map((s) => (
                  <div key={s.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setSolution(s)}
                      className="pressable flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:text-primary"
                    >
                      <span className="truncate">{s.problem || "Solved problem"}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                    </button>
                    <ConfirmDelete
                      label="Delete saved solution"
                      onConfirm={() => {
                        if (!selectedId) return;
                        const next = solutions.filter((x) => x.id !== s.id);
                        saveSolutions(selectedId, next);
                        setSolutions(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flashcard sets grid, or the open set's stack */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                {openSetId && (
                  <button
                    onClick={() => setOpenSetId(null)}
                    aria-label="Back to sets"
                    className="pressable grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-primary"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <Layers className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">
                  {openSetId ? (openSetId === UNSORTED ? "Unsorted" : activeSet?.name ?? "Set") : "Flashcard sets"}
                </h2>
                <span className="text-xs text-muted tabular-nums">
                  {openSetId ? visibleCards.length : cards.length}
                </span>
              </div>
              {dueCount > 0 && (
                <button onClick={startReview} className="neu-btn px-3 py-1.5 text-xs font-medium text-primary">
                  Review {dueCount} due
                </button>
              )}
            </div>

            {/* Review stats */}
            {fcStats && fcStats.reviews > 0 && (
              <div className="flex flex-wrap gap-2 px-1 text-xs text-muted">
                <span className="neu-inset rounded-full px-3 py-1 tabular-nums">
                  {todayReviews(fcStats)} reviewed today
                </span>
                <span className="neu-inset rounded-full px-3 py-1 tabular-nums">
                  {accuracy(fcStats)}% accuracy
                </span>
                {streak(fcStats) > 0 && (
                  <span className="neu-inset flex items-center gap-1 rounded-full px-3 py-1 tabular-nums text-warning">
                    <Flame className="h-3.5 w-3.5" /> {streak(fcStats)}-day streak
                  </span>
                )}
              </div>
            )}

            {cards.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                No cards yet — hit Generate and choose Flashcards.
              </p>
            ) : !openSetId ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sets.map((s) => {
                  const avg = avgScore(s);
                  const count = s.cardIds.filter((id) => cards.some((c) => c.id === id)).length;
                  return (
                    <div key={s.id} className="glass space-y-2.5 p-4">
                      <div className="flex items-start justify-between gap-2">
                        {renamingSetId === s.id ? (
                          <input
                            autoFocus
                            value={setNameDraft}
                            onChange={(e) => setSetNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") doRenameSet(s.id, setNameDraft);
                              if (e.key === "Escape") setRenamingSetId(null);
                            }}
                            onBlur={() => doRenameSet(s.id, setNameDraft)}
                            className="field min-w-0 flex-1 rounded-lg px-2 py-1 text-sm font-medium outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => setOpenSetId(s.id)}
                            className="min-w-0 flex-1 truncate text-left text-sm font-semibold hover:text-primary"
                          >
                            {s.name}
                          </button>
                        )}
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            onClick={() => {
                              setSetNameDraft(s.name);
                              setRenamingSetId(renamingSetId === s.id ? null : s.id);
                            }}
                            aria-label="Rename set"
                            className="pressable grid h-6 w-6 place-items-center rounded-lg text-muted hover:text-primary"
                          >
                            {renamingSetId === s.id ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3 w-3" />}
                          </button>
                          <ConfirmDelete label="Delete set" onConfirm={() => doDeleteSet(s.id)} />
                        </div>
                      </div>
                      <button onClick={() => setOpenSetId(s.id)} className="block w-full text-left">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                              DIFF_STYLE[s.difficulty],
                            )}
                          >
                            {s.difficulty}
                          </span>
                          <span className="text-xs text-muted">{count} cards</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                          <span>{s.completions} completed</span>
                          <span className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            {avg != null ? `${avg}% avg` : "—"}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })}
                {unsortedCards.length > 0 && (
                  <button
                    onClick={() => setOpenSetId(UNSORTED)}
                    className="glass space-y-2.5 p-4 text-left hover:text-primary"
                  >
                    <p className="text-sm font-semibold">Unsorted</p>
                    <p className="text-xs text-muted">{unsortedCards.length} cards · no set</p>
                  </button>
                )}
              </div>
            ) : (
              <div className="py-4">
                <FlashcardStack
                  cards={visibleCards}
                  onUpdate={updateCard}
                  onDelete={deleteCard}
                  onDeleteAll={deleteAllCards}
                  setName={activeSet?.name}
                  onRename={activeSet ? (name) => doRenameSet(activeSet.id, name) : undefined}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Generation dialog */}
      <Modal open={dialog} onClose={() => !generating && setDialog(false)} title="Generate study material">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOpts({ ...opts, type: t.id })}
                  className={cn(
                    "pressable rounded-xl p-3 text-left",
                    opts.type === t.id ? "neu text-primary" : "neu-inset text-muted",
                  )}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted">{t.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {opts.type === "solver" ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Problem to solve</p>
              <textarea
                value={opts.problem}
                onChange={(e) => setOpts({ ...opts, problem: e.target.value })}
                placeholder="Paste the exercise / exam question. e.g. Evaluate $\int_0^1 x e^x\,dx$."
                rows={4}
                className={cn(field, "resize-none")}
              />
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="mb-2 text-xs font-medium text-muted">Difficulty</p>
                <div className="flex gap-2">
                  {DIFFS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setOpts({ ...opts, difficulty: d })}
                      className={cn(
                        "pressable flex-1 rounded-lg py-2 text-sm capitalize",
                        opts.difficulty === d ? "neu text-primary" : "neu-inset text-muted",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-24">
                <p className="mb-2 text-xs font-medium text-muted">
                  {opts.type === "flashcards" ? "Flashcards" : "Questions"}
                </p>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={opts.count}
                  onChange={(e) => setOpts({ ...opts, count: parseInt(e.target.value) || 1 })}
                  className={field}
                />
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-muted">
              {opts.type === "solver" ? "Extra instructions (optional)" : "Custom instructions (optional)"}
            </p>
            <textarea
              value={opts.prompt}
              onChange={(e) => setOpts({ ...opts, prompt: e.target.value })}
              placeholder="e.g. Focus on chapter 4, integration by parts; make question 1 a proof."
              rows={3}
              className={cn(field, "resize-none")}
            />
          </div>

          {subjectResources.length > 0 && (
            <div>
              <p className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
                <span>Materials to ground the AI</span>
                <span className="text-[11px]">{pickedResources.length ? `${pickedResources.length} selected` : "all files"}</span>
              </p>
              <div className="neu-inset flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl p-2">
                {subjectResources.map((r) => {
                  const on = pickedResources.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        setPickedResources((p) => (on ? p.filter((x) => x !== r.id) : [...p, r.id]))
                      }
                      title={r.title}
                      className={cn(
                        "pressable max-w-[14rem] truncate rounded-full px-2.5 py-1 text-[11px]",
                        on ? "neu text-primary" : "text-muted hover:text-foreground",
                      )}
                    >
                      {r.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-muted">Model</p>
            <Dropdown value={model} options={MODEL_OPTIONS} onChange={setModel} up />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDialog(false)}
              disabled={generating}
              className="pressable rounded-xl px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={generate}
              disabled={generating || (opts.type === "solver" && !opts.problem.trim())}
              className="neu-btn flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? (opts.type === "solver" ? "Solving…" : "Generating…") : opts.type === "solver" ? "Solve" : "Generate"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Solver result — step-by-step worked solution */}
      <Modal open={!!solution} onClose={() => setSolution(null)} title="Step-by-step solution">
        {solution && (
          <div className="space-y-4">
            {solution.problem && (
              <div className="neu-inset rounded-xl p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">Problem</p>
                <div className="text-sm leading-relaxed">
                  <MathText>{solution.problem}</MathText>
                </div>
              </div>
            )}
            <ol className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {solution.steps.map((s, i) => (
                <li key={i} className="neu rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="neu-inset grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-primary"
                      data-numeric
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {s.heading && <p className="mb-1 text-sm font-semibold leading-snug"><MathText>{s.heading}</MathText></p>}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        <MathText>{s.detail}</MathText>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="rounded-xl border-l-2 border-primary/60 bg-primary/5 px-4 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/80">Final answer</p>
              <div className="text-sm font-medium leading-relaxed">
                <MathText>{solution.answer}</MathText>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setSolution(null)} className="neu-btn px-4 py-2 text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Single exam — full-screen, readable "exam paper" view (not a cramped modal) */}
      <AnimatePresence>
        {openExam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] overflow-y-auto bg-background/95 backdrop-blur-sm"
          >
            <div className="sticky top-0 z-10 border-b border-foreground/10 bg-background/80 backdrop-blur">
              <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
                <button
                  onClick={() => setOpenExam(null)}
                  aria-label="Back to Study Lab"
                  className="pressable grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:text-primary"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold leading-tight">{examName(openExam)}</h2>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", DIFF_STYLE[openExam.difficulty])}>
                      {openExam.difficulty}
                    </span>
                    <span>{openExam.questions.length} questions</span>
                    {openExam.questions.some((q) => q.points != null) && (
                      <span data-numeric>· {openExam.questions.reduce((a, q) => a + (q.points ?? 0), 0)} pts</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setRevealed((s) =>
                      s.size === openExam.questions.length
                        ? new Set()
                        : new Set(openExam.questions.map((_, i) => i)),
                    )
                  }
                  className="neu-btn shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-primary"
                >
                  {revealed.size === openExam.questions.length ? "Hide all" : "Reveal all"}
                </button>
              </div>
            </div>

            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
              <ol className="space-y-5">
                {openExam.questions.map((q, i) => {
                  const isOpen = revealed.has(i);
                  return (
                    <li key={i} className="glass rounded-2xl p-5 sm:p-6">
                      <div className="flex items-start gap-3.5">
                        <span
                          className="neu-inset grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-primary"
                          data-numeric
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-semibold leading-relaxed sm:text-lg">
                            <MathText>{q.question}</MathText>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {q.points != null && (
                              <span className="neu-inset rounded-full px-2.5 py-0.5 text-[11px] font-medium text-muted" data-numeric>
                                {q.points} pts
                              </span>
                            )}
                            <button
                              onClick={() =>
                                setRevealed((s) => {
                                  const n = new Set(s);
                                  if (n.has(i)) n.delete(i);
                                  else n.add(i);
                                  return n;
                                })
                              }
                              className="pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-primary"
                            >
                              {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {isOpen ? "Hide solution" : "Show solution"}
                            </button>
                          </div>
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 rounded-xl border-l-2 border-primary/60 bg-primary/5 px-4 py-3.5">
                                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/80">
                                    Worked solution
                                  </p>
                                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 sm:text-[15px]">
                                    <MathText>{q.answer}</MathText>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-8 flex justify-center">
                <button onClick={() => setOpenExam(null)} className="neu-btn px-5 py-2.5 text-sm font-medium">
                  Close exam
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flashcard review (SRS) */}
      <Modal open={reviewing} onClose={() => setReviewing(false)} title="Review">
        {reviewQueue[reviewIdx] && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Card {reviewIdx + 1} of {reviewQueue.length}
            </p>
            <div className="neu-inset min-h-32 rounded-xl p-5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {showAns ? "Answer" : "Question"}
              </p>
              <p className={cn("mt-1 text-base", !showAns && "font-semibold")}>
                <MathText>{showAns ? reviewQueue[reviewIdx].back : reviewQueue[reviewIdx].front}</MathText>
              </p>
            </div>
            {!showAns ? (
              <button
                onClick={() => setShowAns(true)}
                className="neu-btn w-full py-2.5 text-sm font-medium"
              >
                Show answer
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => gradeCard(reviewQueue[reviewIdx], "again")}
                  className="neu-btn py-2.5 text-sm font-medium text-danger"
                >
                  Again
                </button>
                <button
                  onClick={() => gradeCard(reviewQueue[reviewIdx], "good")}
                  className="neu-btn py-2.5 text-sm font-medium text-primary"
                >
                  Good
                </button>
                <button
                  onClick={() => gradeCard(reviewQueue[reviewIdx], "easy")}
                  className="neu-btn py-2.5 text-sm font-medium text-success"
                >
                  Easy
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
