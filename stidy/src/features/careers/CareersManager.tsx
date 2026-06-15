"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  GraduationCap,
  CalendarDays,
  FlaskConical,
  FolderOpen,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Career, CareerKind, Subject, TermSystem } from "@/types/db";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EmojiPicker } from "@/components/ui/EmojiPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubjectIcon } from "@/components/ui/SubjectIcon";
import { FadeIn } from "@/components/motion/FadeIn";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { useGradeScale, formatGrade, type GradeScale } from "@/lib/grade-scale";
import { setSubjectIcon } from "@/lib/subject-icons";
import { ExternalExamsPanel } from "@/features/careers/ExternalExamsPanel";
import { cn } from "@/lib/utils";

const COLORS = ["#14b8a6", "#3b82f6", "#f59e0b", "#22c55e", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444"];
const field = "field w-full rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted";

const KIND_OPTS = [
  { value: "degree", label: "Degree / University" },
  { value: "bachillerato", label: "Bachillerato / School" },
  { value: "oposicion", label: "Oposición" },
  { value: "other", label: "Other" },
];
const KIND_BADGE: Record<CareerKind, string> = {
  degree: "bg-primary/15 text-primary",
  bachillerato: "bg-secondary/15 text-secondary",
  oposicion: "bg-warning/15 text-warning",
  other: "bg-foreground/10 text-muted",
};
const TERM_OPTS = [
  { value: "semester", label: "Semesters" },
  { value: "cuatrimestre", label: "Cuatrimestres" },
  { value: "trimestre", label: "Trimestres" },
  { value: "year", label: "Full year" },
];
const TERM_NOUN: Record<TermSystem, string> = {
  semester: "Semester",
  cuatrimestre: "Cuatrimestre",
  trimestre: "Trimestre",
  year: "Year",
};

const hasExternal = (k: CareerKind) => k === "bachillerato" || k === "oposicion";

/** Credit-weighted (or simple) average of member subjects' grades, 0–100. */
function careerAverage(subs: Subject[]): number | null {
  const graded = subs.filter((s) => s.current_grade != null);
  if (!graded.length) return null;
  const anyCredits = graded.some((s) => s.credits);
  if (anyCredits) {
    let sum = 0;
    let w = 0;
    for (const s of graded) {
      const c = Number(s.credits) || 1;
      sum += Number(s.current_grade) * c;
      w += c;
    }
    return w ? sum / w : null;
  }
  return graded.reduce((a, s) => a + Number(s.current_grade), 0) / graded.length;
}

type CareerDraft = Partial<Career> & { name: string };
type SubjectDraft = Partial<Subject> & { name: string };

export function CareersManager() {
  const supabase = useMemo(() => createClient(), []);
  const scale = useGradeScale((s) => s.scale);
  const [userId, setUserId] = useState<string | null>(null);
  const [careers, setCareers] = useState<Career[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [careerDraft, setCareerDraft] = useState<CareerDraft | null>(null);
  const [subjectDraft, setSubjectDraft] = useState<SubjectDraft | null>(null);
  const [subjectIconDraft, setSubjectIconDraft] = useState("");
  const [careerIconDraft, setCareerIconDraft] = useState("");

  async function load() {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("careers").select("*").order("created_at"),
      supabase.from("subjects").select("*").is("parent_id", null).order("created_at"),
    ]);
    setCareers((c as Career[]) ?? []);
    setSubjects((s as Subject[]) ?? []);
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

  // ---- careers ----
  async function saveCareer() {
    if (!careerDraft || !careerDraft.name.trim() || !userId) return;
    const patch = {
      name: careerDraft.name.trim(),
      institution: careerDraft.institution?.toString().trim() || null,
      kind: (careerDraft.kind as CareerKind) ?? "degree",
      country: careerDraft.country?.toString().trim() || null,
      term_system: (careerDraft.term_system as TermSystem) ?? "semester",
      start_year: careerDraft.start_year ? Number(careerDraft.start_year) : null,
      color: careerDraft.color ?? COLORS[0],
      icon: careerIconDraft || null,
    };
    const run = (p: Record<string, unknown>) =>
      careerDraft.id
        ? supabase.from("careers").update(p).eq("id", careerDraft.id)
        : supabase.from("careers").insert({ user_id: userId, ...p });
    let { error: e } = await run(patch);
    // Graceful: works before the migration adds the new columns.
    if (e && /column|could not find/i.test(e.message)) {
      const { name, institution, color } = patch;
      ({ error: e } = await run({ name, institution, color }));
      if (!e) setError("Saved. Run the latest SQL migration to enable career kind, terms & external exams.");
    } else if (e) {
      return setError(e.message);
    }
    if (e) return setError(e.message);
    setCareerDraft(null);
    await load();
  }

  async function removeCareer(id: string) {
    const { error: e } = await supabase.from("careers").delete().eq("id", id);
    if (e) return setError(e.message);
    await load();
  }

  // ---- subjects ----
  async function saveSubject() {
    if (!subjectDraft || !subjectDraft.name.trim() || !userId) return;
    const patch = {
      name: subjectDraft.name.trim(),
      code: subjectDraft.code?.toString().trim() || null,
      professor: subjectDraft.professor?.toString().trim() || null,
      career_id: subjectDraft.career_id || null,
      year: subjectDraft.year ? Number(subjectDraft.year) : null,
      term: subjectDraft.term ? Number(subjectDraft.term) : null,
      icon: subjectIconDraft || null,
      color: subjectDraft.color ?? COLORS[0],
    };
    // Strip the migration-only columns if the DB doesn't have them yet.
    const stripNew = (p: typeof patch) => {
      const { icon: _i, year: _y, term: _t, ...basic } = p;
      return basic;
    };
    if (subjectDraft.id) {
      let { error: e } = await supabase.from("subjects").update(patch).eq("id", subjectDraft.id);
      if (e && /column|could not find/i.test(e.message)) {
        ({ error: e } = await supabase.from("subjects").update(stripNew(patch)).eq("id", subjectDraft.id));
      }
      if (e) return setError(e.message);
      setSubjectIcon(subjectDraft.id, subjectIconDraft);
    } else {
      let { data, error: e } = await supabase.from("subjects").insert({ user_id: userId, ...patch }).select().single();
      if (e && /column|could not find/i.test(e.message)) {
        ({ data, error: e } = await supabase
          .from("subjects")
          .insert({ user_id: userId, ...stripNew(patch) })
          .select()
          .single());
      }
      if (e) return setError(e.message);
      if (data) {
        setSubjectIcon(data.id, subjectIconDraft);
        await supabase.from("grading_structures").insert({ user_id: userId, subject_id: data.id, categories: [] });
      }
    }
    setSubjectDraft(null);
    await load();
  }

  async function removeSubject(id: string) {
    const { error: e } = await supabase.from("subjects").delete().eq("id", id);
    if (e) return setError(e.message);
    await load();
  }

  if (loading) return null;

  const grouped = careers.map((c) => ({ career: c, subs: subjects.filter((s) => s.career_id === c.id) }));
  const unassigned = subjects.filter((s) => !s.career_id);
  const isEmpty = careers.length === 0 && subjects.length === 0;

  const careerOpts = [
    { value: "", label: "No career" },
    ...careers.map((c) => ({ value: c.id, label: c.name })),
  ];

  function openNewSubject(careerId?: string) {
    setSubjectIconDraft("");
    setSubjectDraft({ name: "", color: COLORS[0], career_id: careerId ?? null });
  }

  return (
    <FadeIn className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display-3">Subjects &amp; <span className="text-gradient">Careers</span></h1>
          <p className="mt-1 text-sm text-muted">Group your courses by degree, school year or oposición.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCareerIconDraft("");
              setCareerDraft({ name: "", color: COLORS[0], kind: "degree", term_system: "semester" });
            }}
            className="neu-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
          >
            <Layers className="h-4 w-4" /> New career
          </button>
          <button
            onClick={() => openNewSubject()}
            className="neu-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> New subject
          </button>
        </div>
      </header>

      {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

      {isEmpty && (
        <EmptyState icon={<Layers className="h-6 w-6" />} title="No subjects yet">
          Create a career (degree, bachillerato, oposición…) to group your subjects, or add a single
          subject. You can also import a syllabus in the Grade Engine.
        </EmptyState>
      )}

      {grouped.map(({ career, subs }) => {
        const avg = careerAverage(subs);
        return (
          <FadeIn key={career.id} className="space-y-3">
            <div className="glass flex flex-wrap items-center gap-4 p-4">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl text-white"
                style={{ background: career.color ?? COLORS[0] }}
                aria-hidden
              >
                {career.icon ? career.icon : <Layers className="h-6 w-6" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold">{career.name}</h2>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", KIND_BADGE[career.kind])}>
                    {career.kind}
                  </span>
                </div>
                <p className="truncate text-xs text-muted">
                  {[career.institution, career.country].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">Career average</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {avg == null ? "—" : formatGrade(avg, scale)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setCareerIconDraft(career.icon ?? "");
                    setCareerDraft({ ...career });
                  }}
                  aria-label="Edit career"
                  className="pressable grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <ConfirmDelete label="Delete career" onConfirm={() => removeCareer(career.id)} />
              </div>
            </div>

            {hasExternal(career.kind) && userId && (
              <ExternalExamsPanel careerId={career.id} userId={userId} accent={career.color ?? COLORS[0]} />
            )}

            <SubjectsGrid
              subs={subs}
              scale={scale}
              termNoun={TERM_NOUN[career.term_system]}
              onEdit={(s) => {
                setSubjectIconDraft(s.icon ?? "");
                setSubjectDraft({ ...s });
              }}
              onDelete={removeSubject}
              onAdd={() => openNewSubject(career.id)}
            />
          </FadeIn>
        );
      })}

      {unassigned.length > 0 && (
        <FadeIn className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-muted">No career</h2>
          <SubjectsGrid
            subs={unassigned}
            scale={scale}
            termNoun="Term"
            onEdit={(s) => {
              setSubjectIconDraft(s.icon ?? "");
              setSubjectDraft({ ...s });
            }}
            onDelete={removeSubject}
            onAdd={() => openNewSubject()}
          />
        </FadeIn>
      )}

      {/* Career dialog */}
      <Modal open={!!careerDraft} onClose={() => setCareerDraft(null)} title={careerDraft?.id ? "Edit career" : "New career"}>
        {careerDraft && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <EmojiPicker value={careerIconDraft} onChange={setCareerIconDraft} />
              <input
                autoFocus
                value={careerDraft.name}
                onChange={(e) => setCareerDraft({ ...careerDraft, name: e.target.value })}
                placeholder="Career name (e.g. Medicina, 1º Bachillerato)"
                className={field}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Dropdown
                value={careerDraft.kind ?? "degree"}
                options={KIND_OPTS}
                onChange={(v) => setCareerDraft({ ...careerDraft, kind: v as CareerKind })}
              />
              <Dropdown
                value={careerDraft.term_system ?? "semester"}
                options={TERM_OPTS}
                onChange={(v) => setCareerDraft({ ...careerDraft, term_system: v as TermSystem })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={careerDraft.institution ?? ""}
                onChange={(e) => setCareerDraft({ ...careerDraft, institution: e.target.value })}
                placeholder="Institution (UCM…)"
                className={field}
              />
              <input
                value={careerDraft.country ?? ""}
                onChange={(e) => setCareerDraft({ ...careerDraft, country: e.target.value })}
                placeholder="Country (España…)"
                className={field}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setCareerDraft({ ...careerDraft, color: c })}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform hover:scale-110",
                    careerDraft.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-[hsl(var(--surface))]",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCareerDraft(null)} className="pressable rounded-xl px-4 py-2 text-sm text-muted hover:text-foreground">
                Cancel
              </button>
              <button onClick={saveCareer} disabled={!careerDraft.name.trim()} className="neu-btn px-4 py-2 text-sm font-medium disabled:opacity-50">
                {careerDraft.id ? "Save" : "Create"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Subject dialog */}
      <Modal open={!!subjectDraft} onClose={() => setSubjectDraft(null)} title={subjectDraft?.id ? "Edit subject" : "New subject"}>
        {subjectDraft && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <EmojiPicker value={subjectIconDraft} onChange={setSubjectIconDraft} />
              <input
                autoFocus
                value={subjectDraft.name}
                onChange={(e) => setSubjectDraft({ ...subjectDraft, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && saveSubject()}
                placeholder="Subject name"
                className={field}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={subjectDraft.code ?? ""}
                onChange={(e) => setSubjectDraft({ ...subjectDraft, code: e.target.value })}
                placeholder="Code (MATH 102)"
                className={field}
              />
              <input
                value={subjectDraft.professor ?? ""}
                onChange={(e) => setSubjectDraft({ ...subjectDraft, professor: e.target.value })}
                placeholder="Professor"
                className={field}
              />
            </div>
            <Dropdown
              value={subjectDraft.career_id ?? ""}
              options={careerOpts}
              onChange={(v) => setSubjectDraft({ ...subjectDraft, career_id: v || null })}
              placeholder="Career"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={subjectDraft.year ?? ""}
                onChange={(e) => setSubjectDraft({ ...subjectDraft, year: e.target.value ? Number(e.target.value) : null })}
                placeholder="Year (1, 2…)"
                inputMode="numeric"
                className={field}
              />
              <input
                value={subjectDraft.term ?? ""}
                onChange={(e) => setSubjectDraft({ ...subjectDraft, term: e.target.value ? Number(e.target.value) : null })}
                placeholder="Term (1, 2…)"
                inputMode="numeric"
                className={field}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setSubjectDraft({ ...subjectDraft, color: c })}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform hover:scale-110",
                    subjectDraft.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-[hsl(var(--surface))]",
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSubjectDraft(null)} className="pressable rounded-xl px-4 py-2 text-sm text-muted hover:text-foreground">
                Cancel
              </button>
              <button onClick={saveSubject} disabled={!subjectDraft.name.trim()} className="neu-btn px-4 py-2 text-sm font-medium disabled:opacity-50">
                {subjectDraft.id ? "Save" : "Create"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </FadeIn>
  );
}

/** Responsive grid of subject cards with an inline "add" tile. */
function SubjectsGrid({
  subs,
  scale,
  termNoun,
  onEdit,
  onDelete,
  onAdd,
}: {
  subs: Subject[];
  scale: GradeScale;
  termNoun: string;
  onEdit: (s: Subject) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {subs.map((s) => (
          <StaggerItem key={s.id}>
            <div className="glass group flex h-full flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <SubjectIcon id={s.id} color={s.color} size="lg" />
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{s.name}</h3>
                    <p className="truncate text-xs text-muted">
                      {[s.code, s.professor].filter(Boolean).join(" · ") || "No details"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit(s)}
                    aria-label="Edit subject"
                    className="pressable grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <ConfirmDelete label="Delete subject" onConfirm={() => onDelete(s.id)} />
                </div>
              </div>

              {(s.year || s.term) && (
                <div className="flex flex-wrap gap-1.5">
                  {s.year ? (
                    <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-muted">Year {s.year}</span>
                  ) : null}
                  {s.term ? (
                    <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-muted">
                      {termNoun} {s.term}
                    </span>
                  ) : null}
                </div>
              )}

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
                    <Link key={label} href={href} title={label} aria-label={label} className="neu-btn grid h-9 flex-1 place-items-center rounded-lg">
                      <Icon className="h-4 w-4" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </StaggerItem>
        ))}
      </AnimatePresence>
      <button
        onClick={onAdd}
        className="pressable grid min-h-[160px] place-items-center rounded-[var(--radius)] border-2 border-dashed border-border/60 text-muted hover:border-primary hover:text-primary"
      >
        <span className="flex flex-col items-center gap-1 text-sm">
          <Plus className="h-5 w-5" /> Add subject
        </span>
      </button>
    </Stagger>
  );
}
