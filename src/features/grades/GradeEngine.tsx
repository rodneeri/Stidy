"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Trash2,
  SlidersHorizontal,
  GraduationCap,
  Upload,
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  Lightbulb,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Category, Grade, GradingStructure, Subject } from "@/types/db";
import {
  categoryAverage,
  neededOnRemaining,
  projectedFinal,
  totalWeight,
  weightedGrade,
} from "@/features/grades/lib/calc";
import { NeuSlider } from "@/components/ui/NeuSlider";
import { Dropdown } from "@/components/ui/Dropdown";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { SyllabusUploadDialog } from "@/features/syllabus/SyllabusUploadDialog";
import { SyllabusReviewDialog, type ReviewData } from "@/features/syllabus/SyllabusReviewDialog";
import { SubjectMenu } from "@/features/grades/SubjectMenu";
import { SubjectIcon } from "@/components/ui/SubjectIcon";
import { FadeIn } from "@/components/motion/FadeIn";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { useGradeScale, formatGrade, SCALE_OPTIONS, type GradeScale } from "@/lib/grade-scale";
import { cn } from "@/lib/utils";

type Analysis = {
  headline: string;
  points: { tone: "positive" | "warning" | "tip"; text: string }[];
};

const TONE = {
  positive: { cls: "bg-success/15 text-success", Icon: Check },
  warning: { cls: "bg-warning/15 text-warning", Icon: AlertTriangle },
  tip: { cls: "bg-primary/15 text-primary", Icon: Lightbulb },
} as const;

function GradeDial({ value }: { value: number | null }) {
  const scale = useGradeScale((s) => s.scale);
  const pct = value ?? 0;
  return (
    <div
      className="grid h-32 w-32 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-primary) ${pct}%, hsl(var(--border)) 0)`,
      }}
    >
      <div className="grid h-[104px] w-[104px] place-items-center rounded-full bg-background">
        <span className="text-2xl font-semibold">
          {formatGrade(value, scale, { suffix: false, decimals: scale === "percent" ? 0 : 1 })}
        </span>
      </div>
    </div>
  );
}

const field =
  "field rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted";

export function GradeEngine({ autoImport = false }: { autoImport?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const scale = useGradeScale((s) => s.scale);
  const setScale = useGradeScale((s) => s.setScale);
  const [userId, setUserId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [structure, setStructure] = useState<GradingStructure | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [newSubject, setNewSubject] = useState("");
  const [newCat, setNewCat] = useState({ name: "", weight: "" });
  const [ghosts, setGhosts] = useState<
    Record<string, { title: string; score: string; max: string; weight: string }>
  >({});
  const [whatIf, setWhatIf] = useState(80);
  const [targetFinal, setTargetFinal] = useState("");
  const [target, setTarget] = useState(90);
  const [importing, setImporting] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const categories = structure?.categories ?? [];

  const reloadSubjects = useCallback(async () => {
    const { data } = await supabase.from("subjects").select("*").order("created_at");
    setSubjects((data as Subject[]) ?? []);
  }, [supabase]);

  const loadSelected = useCallback(
    async (id: string) => {
      const [{ data: struct }, { data: gr }] = await Promise.all([
        supabase.from("grading_structures").select("*").eq("subject_id", id).maybeSingle(),
        supabase.from("grades").select("*").eq("subject_id", id).order("created_at"),
      ]);
      const cats = (struct as GradingStructure | null)?.categories ?? [];
      const gradeRows = (gr as Grade[]) ?? [];
      setStructure((struct as GradingStructure) ?? null);
      setGrades(gradeRows);
      if (struct?.target_grade != null) setTarget(struct.target_grade);

      // Keep the cached subject grade weight-aware regardless of the DB function,
      // so the dashboard + badges always match the engine dial.
      const computed = weightedGrade(cats, gradeRows);
      await supabase.from("subjects").update({ current_grade: computed }).eq("id", id);
    },
    [supabase],
  );

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase.from("subjects").select("*").order("created_at");
      const list = (data as Subject[]) ?? [];
      setSubjects(list);
      if (list[0]) setSelectedId(list[0].id);
      setLoading(false);
    })();
  }, [supabase]);

  useEffect(() => {
    if (selectedId) loadSelected(selectedId);
  }, [selectedId, loadSelected]);

  // Magic onboarding deep-link (/grades?import=1) opens the importer immediately.
  useEffect(() => {
    if (autoImport) setShowUpload(true);
  }, [autoImport]);

  // Keep the editable "projected final" in sync when the subject's grades change.
  useEffect(() => {
    const p = projectedFinal(structure?.categories ?? [], grades, whatIf);
    setTargetFinal(p == null ? "" : p.toFixed(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grades, structure]);

  const guard = (e: { message: string } | null) => {
    if (e) setError(e.message);
    return !e;
  };

  async function createSubject() {
    if (!newSubject.trim() || !userId) return;
    const { data, error: e1 } = await supabase
      .from("subjects")
      .insert({ user_id: userId, name: newSubject.trim() })
      .select()
      .single();
    if (!guard(e1) || !data) return;
    await supabase
      .from("grading_structures")
      .insert({ user_id: userId, subject_id: data.id, categories: [], target_grade: target });
    setNewSubject("");
    await reloadSubjects();
    setSelectedId(data.id);
  }

  // Parse the PDF, then open the review sandbox (no DB writes yet).
  async function importSyllabus(file: File) {
    if (!userId) return;
    setImporting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/syllabus/parse", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not parse the syllabus.");
        return;
      }
      setShowUpload(false);
      setReview({
        name: json.name || "Untitled course",
        code: json.code ?? null,
        professor: json.professor ?? null,
        categories: (json.categories ?? []).map(
          (c: { name?: string; weight?: number; items?: { name?: string; weight?: number }[] }) => ({
            name: c.name ?? "",
            weight: c.weight ?? 0,
            items: (c.items ?? []).map((it) => ({ name: it.name ?? "", weight: it.weight ?? 0 })),
          }),
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setImporting(false);
    }
  }

  // Confirmed in the review sandbox → write subject + structure + items.
  async function createFromSyllabus(d: ReviewData) {
    if (!userId) return;
    const { data: subject, error: e1 } = await supabase
      .from("subjects")
      .insert({ user_id: userId, name: d.name || "Untitled course", code: d.code, professor: d.professor })
      .select()
      .single();
    if (!guard(e1) || !subject) return;

    const cats = d.categories.map((c) => ({ id: crypto.randomUUID(), name: c.name, weight: c.weight }));
    await supabase.from("grading_structures").insert({
      user_id: userId,
      subject_id: subject.id,
      categories: cats,
      source: "ai_syllabus",
      target_grade: target,
    });

    const gradeRows = d.categories.flatMap((c, i) =>
      (c.items ?? []).map((it) => ({
        user_id: userId,
        subject_id: subject.id,
        category_id: cats[i].id,
        title: it.name,
        score: null,
        max_score: 100,
        weight: it.weight,
      })),
    );
    if (gradeRows.length) {
      const { error: e2 } = await supabase.from("grades").insert(gradeRows);
      if (e2) setError("Categories imported, but sub-items need the `weight` column. (" + e2.message + ")");
    }

    setReview(null);
    await reloadSubjects();
    setSelectedId(subject.id);
  }

  async function deleteSubject(id: string) {
    // Cascades to grading_structure + grades via FK on delete cascade.
    const { error: e } = await supabase.from("subjects").delete().eq("id", id);
    if (!guard(e)) return;
    const { data } = await supabase.from("subjects").select("*").order("created_at");
    const list = (data as Subject[]) ?? [];
    setSubjects(list);
    if (selectedId === id) {
      const next = list[0]?.id ?? null;
      setSelectedId(next);
      if (!next) {
        setStructure(null);
        setGrades([]);
      }
    }
  }

  async function saveCategories(next: Category[]) {
    if (!structure) return;
    setStructure({ ...structure, categories: next });
    const { error: e } = await supabase
      .from("grading_structures")
      .update({ categories: next })
      .eq("id", structure.id);
    guard(e);
  }

  async function addCategory() {
    const weight = parseFloat(newCat.weight);
    if (!newCat.name.trim() || Number.isNaN(weight)) return;
    await saveCategories([
      ...categories,
      { id: crypto.randomUUID(), name: newCat.name.trim(), weight },
    ]);
    setNewCat({ name: "", weight: "" });
  }

  async function removeCategory(id: string) {
    await saveCategories(categories.filter((c) => c.id !== id));
    await supabase.from("grades").delete().eq("category_id", id);
    if (selectedId) await loadSelected(selectedId);
  }

  // Ghost-row quick add: an always-present faint row at the bottom of a category.
  const ghostOf = (catId: string) =>
    ghosts[catId] ?? { title: "", score: "", max: "100", weight: "" };
  const setGhost = (catId: string, patch: Partial<ReturnType<typeof ghostOf>>) =>
    setGhosts((g) => ({ ...g, [catId]: { ...ghostOf(catId), ...patch } }));

  async function commitGhost(catId: string) {
    const g = ghostOf(catId);
    if (!g.title.trim() || !userId || !selectedId) return;
    const payload: Record<string, unknown> = {
      user_id: userId,
      subject_id: selectedId,
      category_id: catId,
      title: g.title.trim(),
      score: g.score === "" ? null : parseFloat(g.score),
      max_score: parseFloat(g.max) || 100,
    };
    if (g.weight !== "") payload.weight = parseFloat(g.weight);
    const { error: e } = await supabase.from("grades").insert(payload);
    if (!guard(e)) return;
    setGhosts((gg) => ({ ...gg, [catId]: { title: "", score: "", max: "100", weight: "" } }));
    await loadSelected(selectedId);
    await reloadSubjects();
  }

  async function removeGrade(id: string) {
    await supabase.from("grades").delete().eq("id", id);
    if (selectedId) await loadSelected(selectedId);
    await reloadSubjects();
  }

  // Edit an existing grade item in place (typing updates locally, blur persists).
  function patchGradeLocal(id: string, patch: Partial<Grade>) {
    setGrades((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }
  async function persistGrade(id: string, patch: Partial<Grade>) {
    const { error: e } = await supabase.from("grades").update(patch).eq("id", id);
    if (!guard(e)) return;
    await reloadSubjects();
  }

  async function updateSubject(patch: Partial<Subject>) {
    if (!selectedId) return;
    const { error: e } = await supabase.from("subjects").update(patch).eq("id", selectedId);
    if (!guard(e)) return;
    await reloadSubjects();
  }

  async function analyzeGrades() {
    if (!selectedId) return;
    setAnalyzing(true);
    setError(null);
    try {
      const body = {
        subject: subjects.find((s) => s.id === selectedId)?.name,
        currentGrade: weightedGrade(categories, grades),
        target,
        weightsTotal: totalWeight(categories),
        categories: categories.map((c) => ({
          name: c.name,
          weight: c.weight,
          average: categoryAverage(c, grades),
          items: grades
            .filter((g) => g.category_id === c.id)
            .map((g) => ({
              title: g.title,
              score: g.score,
              max: g.max_score,
              weightInCategory: g.weight,
            })),
        })),
      };
      const res = await fetch("/api/grades/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Analysis failed");
        return;
      }
      setAnalysis(json as Analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  const current = weightedGrade(categories, grades);
  const weightSum = totalWeight(categories);
  const solver = neededOnRemaining(categories, grades, target);
  const selected = subjects.find((s) => s.id === selectedId) ?? null;

  if (loading) return null;

  return (
    <FadeIn className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Grade Engine</h1>
          <p className="mt-1 text-sm text-muted">
            Weighted average, What-If scenarios & the Target Solver.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            value={scale}
            options={SCALE_OPTIONS}
            onChange={(v) => setScale(v as GradeScale)}
            className="w-36"
          />
          <button
            onClick={() => setShowUpload(true)}
            className="neu-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
          >
            <Upload className="h-4 w-4" />
            Import syllabus (AI)
          </button>
        </div>
      </header>

      {error && (
        <p className="flex items-center justify-between rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Subjects column */}
        <div className="space-y-3">
          <Stagger className="glass space-y-2 p-3">
            {subjects.length === 0 && (
              <p className="px-1 py-2 text-sm text-muted">No subjects yet.</p>
            )}
            <AnimatePresence initial={false}>
            {subjects.map((s) => (
              <StaggerItem
                key={s.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg pr-1",
                  selectedId === s.id && "neu",
                )}
              >
                <button
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "pressable flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                    selectedId === s.id ? "text-primary" : "text-muted hover:text-foreground",
                  )}
                >
                  <SubjectIcon id={s.id} color={s.color} size="xs" />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {formatGrade(s.current_grade == null ? null : Number(s.current_grade), scale, {
                      suffix: false,
                      decimals: scale === "percent" ? 0 : 1,
                    })}
                  </span>
                </button>
                <ConfirmDelete
                  onConfirm={() => deleteSubject(s.id)}
                  label="Delete subject"
                  className={cn(
                    "transition-opacity",
                    selectedId === s.id ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                />
              </StaggerItem>
            ))}
            </AnimatePresence>
          </Stagger>

          <div className="glass flex items-center gap-2 p-2">
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSubject()}
              placeholder="New subject…"
              className={cn(field, "flex-1")}
            />
            <button
              onClick={createSubject}
              aria-label="Add subject"
              className="neu-btn grid h-9 w-9 shrink-0 place-items-center rounded-lg"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedId ?? "none"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {!structure ? (
          <div className="glass grid min-h-[320px] place-items-center p-6 text-center">
            <div className="space-y-2">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <p className="font-medium">Create a subject to begin</p>
              <p className="mx-auto max-w-xs text-sm text-muted">
                Add a subject, define its grading weights, then enter grades to see your
                weighted average.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <div className="glass flex flex-wrap items-center gap-6 p-5">
              <GradeDial value={current} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    {selected && <SubjectIcon id={selected.id} color={selected.color} size="lg" />}
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold">{selected?.name}</h2>
                      {(selected?.code || selected?.professor) && (
                        <p className="truncate text-sm text-muted">
                          {[selected?.code, selected?.professor].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {selected && (
                    <SubjectMenu
                      key={selected.id}
                      subject={selected}
                      onUpdate={updateSubject}
                      onDelete={() => deleteSubject(selected.id)}
                    />
                  )}
                </div>
                <p className="mt-3 text-sm text-muted">Current weighted grade</p>
                <p className="text-3xl font-semibold tabular-nums">
                  {current == null ? "No grades yet" : formatGrade(current, scale)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    Math.abs(weightSum - 100) < 0.01 ? "text-muted" : "text-warning",
                  )}
                >
                  Weights total {weightSum}%{" "}
                  {Math.abs(weightSum - 100) >= 0.01 && "— should sum to 100%"}
                </p>
              </div>
            </div>

            {/* Categories + grades */}
            <div className="glass space-y-4 p-5">
              <h2 className="font-semibold">Grading structure</h2>

              {categories.length === 0 && (
                <p className="text-sm text-muted">
                  Add weighting categories (e.g. Midterm 30%, Final 40%, Homework 30%).
                </p>
              )}

              <div className="space-y-4">
                {categories.map((cat) => {
                  const itemAvg = categoryAverage({ ...cat, grade: null }, grades);
                  const items = grades.filter((g) => g.category_id === cat.id);
                  return (
                    <div key={cat.id} className="neu-inset space-y-2 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={cat.name}
                          onChange={(e) =>
                            saveCategories(
                              categories.map((c) =>
                                c.id === cat.id ? { ...c, name: e.target.value } : c,
                              ),
                            )
                          }
                          className={cn(field, "flex-1 font-medium")}
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={cat.weight}
                            onChange={(e) =>
                              saveCategories(
                                categories.map((c) =>
                                  c.id === cat.id
                                    ? { ...c, weight: parseFloat(e.target.value) || 0 }
                                    : c,
                                ),
                              )
                            }
                            className={cn(field, "w-16 text-right")}
                          />
                          <span className="text-sm text-muted">%</span>
                        </div>
                        <input
                          type="number"
                          value={cat.grade ?? ""}
                          placeholder={itemAvg == null ? "grade" : itemAvg.toFixed(0)}
                          title="Grade for the whole category (overrides its items)"
                          onChange={(e) =>
                            saveCategories(
                              categories.map((c) =>
                                c.id === cat.id
                                  ? {
                                      ...c,
                                      grade: e.target.value === "" ? null : parseFloat(e.target.value),
                                    }
                                  : c,
                              ),
                            )
                          }
                          className={cn(field, "w-16 text-right tabular-nums")}
                        />
                        <button
                          onClick={() => removeCategory(cat.id)}
                          aria-label="Remove category"
                          className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {items.length > 0 && (
                        <ul className="space-y-1.5 pl-1">
                          {items.map((g) => (
                            <li key={g.id} className="flex items-center gap-2 text-sm">
                              <input
                                value={g.title}
                                onChange={(e) => patchGradeLocal(g.id, { title: e.target.value })}
                                onBlur={(e) => persistGrade(g.id, { title: e.target.value })}
                                className={cn(field, "min-w-0 flex-1")}
                              />
                              <input
                                type="number"
                                value={g.score ?? ""}
                                placeholder="—"
                                title="Score"
                                onChange={(e) =>
                                  patchGradeLocal(g.id, {
                                    score: e.target.value === "" ? null : parseFloat(e.target.value),
                                  })
                                }
                                onBlur={(e) =>
                                  persistGrade(g.id, {
                                    score: e.target.value === "" ? null : parseFloat(e.target.value),
                                  })
                                }
                                className={cn(field, "w-16 text-right tabular-nums")}
                              />
                              <span className="text-muted">/</span>
                              <input
                                type="number"
                                value={g.max_score}
                                title="Out of"
                                onChange={(e) =>
                                  patchGradeLocal(g.id, { max_score: parseFloat(e.target.value) || 0 })
                                }
                                onBlur={(e) =>
                                  persistGrade(g.id, { max_score: parseFloat(e.target.value) || 100 })
                                }
                                className={cn(field, "w-14 tabular-nums")}
                              />
                              <input
                                type="number"
                                value={g.weight ?? ""}
                                placeholder="wt"
                                title="Weight % within this category"
                                onChange={(e) =>
                                  patchGradeLocal(g.id, {
                                    weight: e.target.value === "" ? null : parseFloat(e.target.value),
                                  })
                                }
                                onBlur={(e) =>
                                  persistGrade(g.id, {
                                    weight: e.target.value === "" ? null : parseFloat(e.target.value),
                                  })
                                }
                                className={cn(field, "w-14 tabular-nums")}
                              />
                              <button
                                onClick={() => removeGrade(g.id)}
                                aria-label="Remove grade"
                                className="pressable grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:text-danger"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Ghost row — always-present faint quick-add */}
                      <div className="flex items-center gap-2 pl-1 text-sm opacity-55 transition-opacity focus-within:opacity-100 hover:opacity-100">
                        <input
                          value={ghostOf(cat.id).title}
                          onChange={(e) => setGhost(cat.id, { title: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && commitGhost(cat.id)}
                          placeholder="+ Add grade…"
                          className={cn(field, "min-w-0 flex-1")}
                        />
                        <input
                          type="number"
                          value={ghostOf(cat.id).score}
                          onChange={(e) => setGhost(cat.id, { score: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && commitGhost(cat.id)}
                          placeholder="—"
                          className={cn(field, "w-16 text-right tabular-nums")}
                        />
                        <span className="text-muted">/</span>
                        <input
                          type="number"
                          value={ghostOf(cat.id).max}
                          onChange={(e) => setGhost(cat.id, { max: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && commitGhost(cat.id)}
                          className={cn(field, "w-14 tabular-nums")}
                        />
                        <input
                          type="number"
                          value={ghostOf(cat.id).weight}
                          onChange={(e) => setGhost(cat.id, { weight: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && commitGhost(cat.id)}
                          placeholder="wt"
                          title="Weight % within this category"
                          className={cn(field, "w-14 tabular-nums")}
                        />
                        <button
                          onClick={() => commitGhost(cat.id)}
                          aria-label="Add grade"
                          className="pressable grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:text-primary"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add category */}
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                <input
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  placeholder="Category (e.g. Final)"
                  className={cn(field, "flex-1")}
                />
                <input
                  type="number"
                  value={newCat.weight}
                  onChange={(e) => setNewCat({ ...newCat, weight: e.target.value })}
                  placeholder="%"
                  className={cn(field, "w-20")}
                />
                <button onClick={addCategory} className="neu-btn px-4 py-2 text-sm font-medium">
                  Add category
                </button>
              </div>
            </div>

            {/* What-If (with editable, back-solving projected final) */}
            <div className="glass space-y-4 p-5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">What-If</h3>
              </div>
              <p className="text-sm text-muted">
                If I score <span className="font-semibold text-foreground">{whatIf}%</span> on everything
                remaining…
              </p>
              <NeuSlider
                value={whatIf}
                onChange={(v) => {
                  setWhatIf(v);
                  const p = projectedFinal(categories, grades, v);
                  setTargetFinal(p == null ? "" : p.toFixed(1));
                }}
                format={(v) => `${v}%`}
              />
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted">Projected final</span>
                {solver.remainingWeight <= 0 ? (
                  <span className="text-2xl font-semibold tabular-nums">
                    {solver.lockedFinal == null ? "—" : `${solver.lockedFinal.toFixed(1)}%`}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      value={targetFinal}
                      onChange={(e) => {
                        setTargetFinal(e.target.value);
                        const f = parseFloat(e.target.value);
                        if (!Number.isNaN(f)) {
                          const { needed } = neededOnRemaining(categories, grades, f);
                          if (needed != null) setWhatIf(Math.max(0, Math.min(100, Math.round(needed))));
                        }
                      }}
                      className={cn(field, "w-24 text-2xl font-semibold tabular-nums")}
                    />
                    <span className="text-2xl font-semibold">%</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                {solver.remainingWeight <= 0
                  ? "All weight is graded — your final is locked in."
                  : `Drag the slider, or type a target final and STiDY back-solves the score you'd need on the remaining ${solver.remainingWeight}% of weight.`}
              </p>
            </div>

            {/* AI grade analysis */}
            <div className="glass space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">AI grade analysis</h3>
                </div>
                <button
                  onClick={analyzeGrades}
                  disabled={analyzing || current == null}
                  className="neu-btn flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze my grades"}
                </button>
              </div>
              {current == null ? (
                <p className="text-sm text-muted">Enter some grades to get an analysis.</p>
              ) : analysis ? (
                <div className="space-y-3">
                  <p className="font-medium">{analysis.headline}</p>
                  <ul className="space-y-2">
                    {analysis.points.map((p, i) => {
                      const { cls, Icon } = TONE[p.tone];
                      return (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <span
                            className={cn(
                              "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                              cls,
                            )}
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                          <span className="text-muted">{p.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Get AI insights on your strengths, risks, and what to prioritise.
                </p>
              )}
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      <SyllabusUploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onFile={(f) => importSyllabus(f)}
        importing={importing}
      />

      <SyllabusReviewDialog
        data={review}
        onConfirm={createFromSyllabus}
        onCancel={() => setReview(null)}
      />
    </FadeIn>
  );
}
