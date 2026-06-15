"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  BookOpen,
  GraduationCap,
  CalendarDays,
  FlaskConical,
  FolderOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/types/db";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeIn } from "@/components/motion/FadeIn";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { useGradeScale, formatGrade } from "@/lib/grade-scale";
import { useSubjectIcons, setSubjectIcon } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";

const COLORS = ["#14b8a6", "#3b82f6", "#f59e0b", "#22c55e", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444"];
const field = "field w-full rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted";

type Draft = Partial<Subject> & { name: string };

export function SubjectsManager() {
  const supabase = useMemo(() => createClient(), []);
  const scale = useGradeScale((s) => s.scale);
  const [userId, setUserId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftIcon, setDraftIcon] = useState("");
  const icons = useSubjectIcons();

  async function load() {
    const { data } = await supabase
      .from("subjects")
      .select("*")
      .is("parent_id", null)
      .order("created_at");
    setSubjects((data as Subject[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      await load();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function save() {
    if (!draft || !draft.name.trim() || !userId) return;
    const patch = {
      name: draft.name.trim(),
      code: draft.code?.toString().trim() || null,
      professor: draft.professor?.toString().trim() || null,
      semester: draft.semester?.toString().trim() || null,
      color: draft.color ?? COLORS[0],
    };
    if (draft.id) {
      const { error: e } = await supabase.from("subjects").update(patch).eq("id", draft.id);
      if (e) return setError(e.message);
      setSubjectIcon(draft.id, draftIcon);
    } else {
      const { data, error: e } = await supabase
        .from("subjects")
        .insert({ user_id: userId, ...patch })
        .select()
        .single();
      if (e) return setError(e.message);
      // Ready a grading structure so the subject opens cleanly in the Grade Engine.
      if (data) {
        setSubjectIcon(data.id, draftIcon);
        await supabase
          .from("grading_structures")
          .insert({ user_id: userId, subject_id: data.id, categories: [] });
      }
    }
    setDraft(null);
    await load();
  }

  async function remove(id: string) {
    const { error: e } = await supabase.from("subjects").delete().eq("id", id);
    if (e) return setError(e.message);
    await load();
  }

  if (loading) return null;

  return (
    <FadeIn className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display-3">Subjects</h1>
          <p className="mt-1 text-sm text-muted">Your courses, professors, and current grades.</p>
        </div>
        <button
          onClick={() => {
            setDraftIcon("");
            setDraft({ name: "", color: COLORS[0] });
          }}
          className="neu-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New subject
        </button>
      </header>

      {error && (
        <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {subjects.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No subjects yet">
          Add one here, or import a syllabus in the Grade Engine to create one automatically.
        </EmptyState>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
          {subjects.map((s) => (
            <StaggerItem key={s.id}>
              <div className="glass group flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
                      style={{ background: s.color ?? COLORS[0] }}
                    >
                      {icons[s.id] ? (
                        <span className="text-xl leading-none">{icons[s.id]}</span>
                      ) : (
                        <BookOpen className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{s.name}</h3>
                      <p className="truncate text-xs text-muted">
                        {[s.code, s.professor].filter(Boolean).join(" · ") || "No details"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setDraftIcon(icons[s.id] ?? "");
                        setDraft({ ...s });
                      }}
                      aria-label="Edit subject"
                      className="pressable grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <ConfirmDelete label="Delete subject" onConfirm={() => remove(s.id)} />
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <div>
                    <p className="text-xs text-muted">Current grade</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatGrade(s.current_grade == null ? null : Number(s.current_grade), scale)}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      { href: "/grades", icon: GraduationCap, label: "Grades" },
                      { href: `/timetable?subject=${s.id}`, icon: CalendarDays, label: "Timetable" },
                      { href: `/flashcards?subject=${s.id}`, icon: FlaskConical, label: "Study Lab" },
                      { href: `/resources?subject=${s.id}`, icon: FolderOpen, label: "Resources" },
                    ].map(({ href, icon: Icon, label }) => (
                      <Link
                        key={label}
                        href={href}
                        title={label}
                        aria-label={label}
                        className="neu-btn grid h-9 flex-1 place-items-center rounded-lg"
                      >
                        <Icon className="h-4 w-4" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
          </AnimatePresence>
        </Stagger>
      )}

      {/* Create / edit dialog */}
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit subject" : "New subject"}>
        {draft && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <EmojiPicker value={draftIcon} onChange={setDraftIcon} />
              <input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder="Subject name"
                className={field}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={draft.code ?? ""}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="Code (MATH 102)"
                className={field}
              />
              <input
                value={draft.semester ?? ""}
                onChange={(e) => setDraft({ ...draft, semester: e.target.value })}
                placeholder="Semester"
                className={field}
              />
            </div>
            <input
              value={draft.professor ?? ""}
              onChange={(e) => setDraft({ ...draft, professor: e.target.value })}
              placeholder="Professor"
              className={field}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform hover:scale-110",
                    draft.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-[hsl(var(--surface))]",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDraft(null)}
                className="pressable rounded-xl px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!draft.name.trim()}
                className="neu-btn px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {draft.id ? "Save" : "Create"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </FadeIn>
  );
}
