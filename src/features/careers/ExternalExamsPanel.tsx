"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ExternalExam } from "@/types/db";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { cn } from "@/lib/utils";

const field = "field rounded-lg px-2.5 py-1.5 text-sm outline-none placeholder:text-muted";

/** Weighted average of the external exams, expressed on a /10 scale. */
function externalAverage(exams: ExternalExam[]): number | null {
  const scored = exams.filter((e) => e.score != null && e.max_score);
  if (!scored.length) return null;
  let wsum = 0;
  let w = 0;
  for (const e of scored) {
    const wt = e.weight ?? 1;
    wsum += (Number(e.score) / Number(e.max_score)) * 10 * wt;
    w += wt;
  }
  return w ? Math.round((wsum / w) * 100) / 100 : null;
}

/**
 * Tracks official exams taken outside the course (EVAU, oposición exams…) for a
 * career. Self-contained: loads its own rows. Degrades gracefully if the
 * `external_exams` table hasn't been migrated yet.
 */
export function ExternalExamsPanel({
  careerId,
  userId,
  accent,
}: {
  careerId: string;
  userId: string;
  accent: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [exams, setExams] = useState<ExternalExam[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [draft, setDraft] = useState({ name: "", score: "", max: "10", weight: "" });

  async function load() {
    const { data, error } = await supabase
      .from("external_exams")
      .select("*")
      .eq("career_id", careerId)
      .order("created_at");
    if (error) {
      setNeedsMigration(/external_exams|relation|does not exist/i.test(error.message));
      return;
    }
    setExams((data as ExternalExam[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careerId]);

  async function add() {
    if (!draft.name.trim()) return;
    const { error } = await supabase.from("external_exams").insert({
      user_id: userId,
      career_id: careerId,
      name: draft.name.trim(),
      score: draft.score === "" ? null : Number(draft.score),
      max_score: draft.max === "" ? 10 : Number(draft.max),
      weight: draft.weight === "" ? null : Number(draft.weight),
    });
    if (error) return setNeedsMigration(/external_exams|does not exist/i.test(error.message));
    setDraft({ name: "", score: "", max: "10", weight: "" });
    await load();
  }

  async function patchScore(id: string, score: string) {
    setExams((es) => es.map((e) => (e.id === id ? { ...e, score: score === "" ? null : Number(score) } : e)));
    await supabase.from("external_exams").update({ score: score === "" ? null : Number(score) }).eq("id", id);
  }

  async function remove(id: string) {
    await supabase.from("external_exams").delete().eq("id", id);
    await load();
  }

  if (needsMigration) {
    return (
      <p className="rounded-lg bg-warning/15 px-3 py-2 text-xs text-foreground">
        Run the latest SQL migration to enable external-exam tracking (EVAU / oposición).
      </p>
    );
  }

  const avg = externalAverage(exams);

  return (
    <div className="neu-inset space-y-2 rounded-xl p-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4" style={{ color: accent }} />
        <p className="flex-1 text-sm font-semibold">External exams</p>
        {avg != null && (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium tabular-nums">
            {avg.toFixed(2)} / 10
          </span>
        )}
      </div>

      {exams.map((e) => (
        <div key={e.id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
          <input
            defaultValue={e.score ?? ""}
            onBlur={(ev) => patchScore(e.id, ev.target.value)}
            placeholder="—"
            inputMode="decimal"
            className={cn(field, "w-16 text-center")}
          />
          <span className="text-xs text-muted">/ {Number(e.max_score)}</span>
          <ConfirmDelete label="Delete exam" onConfirm={() => remove(e.id)} />
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Exam (e.g. EVAU — Matemáticas II)"
          className={cn(field, "min-w-0 flex-1")}
        />
        <input
          value={draft.score}
          onChange={(e) => setDraft({ ...draft, score: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="score"
          inputMode="decimal"
          className={cn(field, "w-16 text-center")}
        />
        <input
          value={draft.max}
          onChange={(e) => setDraft({ ...draft, max: e.target.value })}
          placeholder="max"
          inputMode="decimal"
          className={cn(field, "w-14 text-center")}
        />
        <button onClick={add} className="neu-btn grid h-8 w-8 shrink-0 place-items-center rounded-lg" aria-label="Add exam">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
