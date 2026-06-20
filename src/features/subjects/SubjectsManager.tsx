"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  BookOpen,
  GraduationCap,
  CalendarDays,
  FlaskConical,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Archive,
  ArchiveRestore,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Subject, Career } from "@/types/db";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeIn } from "@/components/motion/FadeIn";
import { useGradeScale, formatGrade } from "@/lib/grade-scale";
import { useSubjectIcons, setSubjectIcon } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";

const COLORS = [
  "#14b8a6", "#3b82f6", "#f59e0b", "#22c55e", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444",
  "#10b981", "#6366f1", "#eab308", "#f43f5e", "#0ea5e9", "#a855f7", "#84cc16", "#fb7185",
  "#f97316", "#64748b",
];
const studyHrs = (s: number) => (s >= 36000 ? `${Math.round(s / 3600)}h` : `${(s / 3600).toFixed(1)}h`);
const field = "field w-full rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted";

type Draft = Partial<Subject> & { name: string };
const NO_CAREER = "__none__";

/** Buckets subjects by `year-term` within a career, preserving a sortable order. */
function termKey(s: Subject) {
  return `${s.year ?? ""}-${s.term ?? ""}`;
}
function termLabel(s: Subject): string | null {
  if (s.year && s.term) return `Year ${s.year} · Term ${s.term}`;
  if (s.year) return `Year ${s.year}`;
  if (s.term) return `Term ${s.term}`;
  return null;
}

export function SubjectsManager() {
  const supabase = useMemo(() => createClient(), []);
  const scale = useGradeScale((s) => s.scale);
  const [userId, setUserId] = useState<string | null>(null);
  const [careers, setCareers] = useState<Career[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [studyTime, setStudyTime] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftIcon, setDraftIcon] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{ label: string; ids: string[] } | null>(null);
  const icons = useSubjectIcons();

  async function load() {
    const [{ data: cs }, { data: ss }, { data: logs }] = await Promise.all([
      supabase.from("careers").select("*").order("position", { ascending: true }).order("name"),
      supabase.from("subjects").select("*").is("parent_id", null).order("created_at"),
      supabase.from("study_logs").select("subject_id, duration_seconds").eq("kind", "focus"),
    ]);
    setCareers((cs as Career[]) ?? []);
    setSubjects((ss as Subject[]) ?? []);
    const bySubject: Record<string, number> = {};
    for (const r of (logs as { subject_id: string | null; duration_seconds: number }[]) ?? []) {
      if (r.subject_id) bySubject[r.subject_id] = (bySubject[r.subject_id] ?? 0) + r.duration_seconds;
    }
    setStudyTime(bySubject);
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

  async function setArchived(ids: string[], archived: boolean) {
    if (ids.length === 0) return;
    const { error: e } = await supabase.from("subjects").update({ archived }).in("id", ids);
    if (e) return setError(e.message);
    setArchiveTarget(null);
    await load();
  }

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const active = subjects.filter((s) => !s.archived);
  const archived = subjects.filter((s) => s.archived);

  // Ordered groups: each career that has active subjects, then an "Other" bucket.
  const groups = useMemo(() => {
    const out: { key: string; career: Career | null; items: Subject[] }[] = [];
    for (const c of careers) {
      const items = active.filter((s) => s.career_id === c.id);
      if (items.length) out.push({ key: c.id, career: c, items });
    }
    const none = active.filter((s) => !s.career_id || !careers.some((c) => c.id === s.career_id));
    if (none.length) out.push({ key: NO_CAREER, career: null, items: none });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careers, subjects]);

  if (loading) return null;

  const card = (s: Subject, opts?: { archived?: boolean }) => (
    <div key={s.id} className="glass group flex h-full flex-col gap-4 p-5">
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
            {[s.code, s.professor].filter(Boolean).length > 0 && (
              <p className="truncate text-xs text-muted">
                {[s.code, s.professor].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {opts?.archived ? (
            <button
              onClick={() => setArchived([s.id], false)}
              aria-label="Unarchive subject"
              title="Unarchive"
              className="pressable grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-primary"
            >
              <ArchiveRestore className="h-4 w-4" />
            </button>
          ) : (
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
          )}
          <ConfirmDelete label="Delete subject" onConfirm={() => remove(s.id)} />
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs text-muted">Current grade</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatGrade(s.current_grade == null ? null : Number(s.current_grade), scale)}
            </p>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 text-xs text-muted">
              <Clock className="h-3 w-3" /> Studied
            </p>
            <p className="text-lg font-semibold tabular-nums">{studyHrs(studyTime[s.id] ?? 0)}</p>
          </div>
        </div>
        {!opts?.archived && (
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
        )}
      </div>
    </div>
  );

  const grid = (items: Subject[], opts?: { archived?: boolean }) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((s) => card(s, opts))}</div>
  );

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

      {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

      {subjects.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No subjects yet">
          Add one here, or import a syllabus in the Grade Engine to create one automatically.
        </EmptyState>
      ) : careers.length === 0 ? (
        // No careers yet → simple flat grid of the active subjects.
        grid(active)
      ) : (
        <div className="space-y-5">
          {groups.map(({ key, career, items }) => {
            const isCollapsed = collapsed.has(key);
            // Term buckets within this career, in a stable label order.
            const buckets = new Map<string, Subject[]>();
            for (const s of items) {
              const k = termKey(s);
              (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(s);
            }
            const orderedKeys = [...buckets.keys()].sort();
            return (
              <section key={key} className="glass overflow-hidden p-0">
                <button
                  onClick={() => toggle(key)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                    style={{ background: career?.color ?? "#64748b" }}
                  >
                    {career?.icon ? (
                      <span className="text-base leading-none">{career.icon}</span>
                    ) : (
                      <GraduationCap className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{career?.name ?? "Other subjects"}</span>
                    {career?.institution && (
                      <span className="block truncate text-xs text-muted">{career.institution}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {items.length} subject{items.length === 1 ? "" : "s"}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-5 px-5 pb-5">
                    {orderedKeys.map((bk) => {
                      const bucket = buckets.get(bk)!;
                      const label = termLabel(bucket[0]);
                      return (
                        <div key={bk} className="space-y-3">
                          {label && (
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                              <button
                                onClick={() =>
                                  setArchiveTarget({
                                    label: `${career?.name ?? "Other"} — ${label}`,
                                    ids: bucket.map((s) => s.id),
                                  })
                                }
                                className="pressable flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted hover:text-primary"
                                title="Archive every subject in this term"
                              >
                                <Archive className="h-3.5 w-3.5" /> Mark term done
                              </button>
                            </div>
                          )}
                          {grid(bucket)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {/* Archived */}
          {archived.length > 0 && (
            <section className="glass overflow-hidden p-0">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left"
              >
                {showArchived ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                )}
                <Archive className="h-4 w-4 shrink-0 text-muted" />
                <span className="flex-1 font-semibold">Archived</span>
                <span className="text-xs text-muted">
                  {archived.length} subject{archived.length === 1 ? "" : "s"}
                </span>
              </button>
              {showArchived && <div className="px-5 pb-5">{grid(archived, { archived: true })}</div>}
            </section>
          )}
        </div>
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

      {/* Archive-term confirm */}
      <Modal open={!!archiveTarget} onClose={() => setArchiveTarget(null)} title="Mark term as done?">
        {archiveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              This archives all {archiveTarget.ids.length} subject
              {archiveTarget.ids.length === 1 ? "" : "s"} in <strong>{archiveTarget.label}</strong>. They&apos;re
              kept (grades, resources, everything) — just hidden from the active view. You can restore them
              anytime from <strong>Archived</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setArchiveTarget(null)}
                className="pressable rounded-xl px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => setArchived(archiveTarget.ids, true)}
                className="neu-btn flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary"
              >
                <Archive className="h-4 w-4" /> Archive term
              </button>
            </div>
          </div>
        )}
      </Modal>
    </FadeIn>
  );
}
