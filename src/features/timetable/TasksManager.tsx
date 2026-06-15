"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { Plus, X, AlertTriangle, Copy, Check, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskPriority } from "@/types/db";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeIn } from "@/components/motion/FadeIn";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { useSubjectIcons } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";

const field = "field rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted";
const PRIO_OPTS = [
  { value: "low", label: "Low priority" },
  { value: "medium", label: "Medium priority" },
  { value: "high", label: "High priority" },
  { value: "urgent", label: "Urgent" },
];
const PRIO_DOT: Record<TaskPriority, string> = {
  low: "bg-muted",
  medium: "bg-primary",
  high: "bg-warning",
  urgent: "bg-danger",
};

const CAT_OPTS = [
  { value: "task", label: "Task" },
  { value: "homework", label: "Homework" },
  { value: "exam", label: "Exam" },
  { value: "quiz", label: "Quiz" },
  { value: "event", label: "Event" },
  { value: "class", label: "Class" },
  { value: "lab", label: "Lab" },
  { value: "project", label: "Project" },
  { value: "reading", label: "Reading" },
  { value: "deadline", label: "Deadline" },
];
const CAT_STYLE: Record<string, string> = {
  exam: "bg-danger/15 text-danger",
  quiz: "bg-danger/10 text-danger",
  homework: "bg-secondary/15 text-secondary",
  project: "bg-primary/15 text-primary",
  lab: "bg-success/15 text-success",
  reading: "bg-accent/15 text-accent",
  deadline: "bg-warning/15 text-warning",
  event: "bg-foreground/10 text-muted",
  class: "bg-foreground/10 text-muted",
  task: "bg-foreground/10 text-muted",
};

/** Heuristic category recommendation from the title text (no AI → no rate limits). */
function recommendCategory(title: string): string {
  const t = title.toLowerCase();
  if (/\b(exam|midterm|final)\b/.test(t)) return "exam";
  if (/\bquiz\b/.test(t)) return "quiz";
  if (/\b(homework|hw|assignment|problem set|pset|worksheet|exercise)\b/.test(t)) return "homework";
  if (/\blab\b/.test(t)) return "lab";
  if (/\bproject\b/.test(t)) return "project";
  if (/\b(read|reading|chapter|textbook|pages?)\b/.test(t)) return "reading";
  if (/\b(class|lecture|seminar|tutorial)\b/.test(t)) return "class";
  if (/\b(meeting|event|party|trip|presentation|talk)\b/.test(t)) return "event";
  if (/\b(deadline|due|submit|deliver|hand in)\b/.test(t)) return "deadline";
  return "task";
}

const GROUPS: { key: string; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "someday", label: "Someday" },
  { key: "done", label: "Completed" },
];

function bucket(t: Task): string {
  if (t.status === "done") return "done";
  if (!t.due_at) return "someday";
  const ms = new Date(t.due_at).getTime();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const endToday = start.getTime() + 86400000;
  const endWeek = start.getTime() + 7 * 86400000;
  if (ms < Date.now()) return "overdue";
  if (ms < endToday) return "today";
  if (ms < endWeek) return "week";
  return "later";
}

function fmtDue(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TasksManager({ filterSubject = null }: { filterSubject?: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const icons = useSubjectIcons();
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    due: "",
    subjectId: "",
    category: "task",
    priority: "medium" as TaskPriority,
  });
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from("tasks").select("*").neq("status", "archived").order("due_at", { ascending: true }),
      supabase.from("subjects").select("id, name").is("parent_id", null).order("name"),
    ]);
    setTasks((t as Task[]) ?? []);
    setSubjects((s as { id: string; name: string }[]) ?? []);
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

  // Preselect the subject when deep-linked from Subjects.
  useEffect(() => {
    if (filterSubject) setForm((f) => ({ ...f, subjectId: filterSubject }));
  }, [filterSubject]);

  async function add() {
    if (!form.title.trim() || !userId) return;
    const payload = {
      user_id: userId,
      title: form.title.trim(),
      due_at: form.due ? new Date(form.due).toISOString() : null,
      subject_id: form.subjectId || null,
      is_exam: form.category === "exam",
      priority: form.priority,
      category: form.category,
    };
    let { error: e } = await supabase.from("tasks").insert(payload);
    // Graceful: works before the `category` column migration too.
    if (e && /category/i.test(e.message)) {
      const { category: _omit, ...rest } = payload;
      ({ error: e } = await supabase.from("tasks").insert(rest));
    }
    if (e) return setError(e.message);
    setForm({ title: "", due: "", subjectId: filterSubject ?? "", category: "task", priority: "medium" });
    setCategoryTouched(false);
    await load();
  }

  async function toggle(t: Task) {
    const status = t.status === "done" ? "todo" : "done";
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)));
    await supabase.from("tasks").update({ status }).eq("id", t.id);
    await load();
  }

  async function remove(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    await load();
  }

  const subjectName = (id: string | null) => subjects.find((s) => s.id === id)?.name;
  const now = Date.now();
  const visible = filterSubject ? tasks.filter((t) => t.subject_id === filterSubject) : tasks;
  const grouped = GROUPS.map((g) => ({
    ...g,
    items: visible.filter((t) => bucket(t) === g.key),
  })).filter((g) => g.items.length);

  // Exam-conflict defusal: 2+ exams/quizzes within a 2-day window.
  const examItems = visible
    .filter((t) => t.status !== "done" && t.due_at && (t.is_exam || t.category === "exam" || t.category === "quiz"))
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
  let conflict: Task[] = [];
  for (let i = 0; i < examItems.length; i++) {
    const grp = examItems.filter((e) => {
      const d = new Date(e.due_at!).getTime() - new Date(examItems[i].due_at!).getTime();
      return d >= 0 && d <= 2 * 86400000;
    });
    if (grp.length >= 2) {
      conflict = grp;
      break;
    }
  }
  const emailText = conflict.length
    ? `Subject: Assessment scheduling — request for consideration\n\nDear Professor,\n\nI hope you're well. I wanted to respectfully flag that I currently have ${conflict.length} major assessments scheduled within a two-day window:\n\n${conflict
        .map((e) => `• ${e.title}${e.due_at ? ` — ${new Date(e.due_at).toDateString()}` : ""}`)
        .join(
          "\n",
        )}\n\nGiven how closely these fall together, I would be very grateful if we could discuss a short extension or an alternative arrangement for your course, so that I can give each assessment the preparation it deserves.\n\nThank you very much for your understanding.\n\nKind regards,\n[Your name]`
    : "";

  const subjectOpts = [{ value: "", label: "No subject" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))];

  const taskRow = (t: Task) => {
    const done = t.status === "done";
    const overdue = !done && t.due_at && new Date(t.due_at).getTime() < now;
    return (
      <div key={t.id} className="glass flex items-center gap-3 p-4">
        <button
          onClick={() => toggle(t)}
          aria-label={done ? "Mark not done" : "Mark done"}
          className={cn(
            "group/c grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-all hover:scale-110 active:scale-90",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:border-primary hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
          )}
        >
          {done ? (
            <span className="text-xs">✓</span>
          ) : (
            <span className="text-xs text-primary opacity-0 transition-opacity group-hover/c:opacity-60">✓</span>
          )}
        </button>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIO_DOT[t.priority])} title={t.priority} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("truncate font-medium", done && "text-muted line-through")}>{t.title}</p>
            {(() => {
              const cat = t.category ?? (t.is_exam ? "exam" : "task");
              if (cat === "task") return null;
              return (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    CAT_STYLE[cat] ?? CAT_STYLE.task,
                  )}
                >
                  {cat}
                </span>
              );
            })()}
          </div>
          <p className={cn("truncate text-xs", overdue ? "text-danger" : "text-muted")}>
            {fmtDue(t.due_at) ?? "No date"}
            {subjectName(t.subject_id)
              ? ` · ${t.subject_id && icons[t.subject_id] ? icons[t.subject_id] + " " : ""}${subjectName(t.subject_id)}`
              : ""}
            {overdue ? " · overdue" : ""}
          </p>
        </div>
        <ConfirmDelete label="Delete task" onConfirm={() => remove(t.id)} />
      </div>
    );
  };

  if (loading) return null;

  return (
    <FadeIn className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
          <p className="mt-1 text-sm text-muted">
            Tasks &amp; exams — these power your dashboard&apos;s next exam and what&apos;s next.
          </p>
        </div>
        {filterSubject && (
          <Link
            href="/timetable"
            className="neu-btn flex items-center gap-2 px-3 py-1.5 text-sm font-medium"
          >
            Filtered: {subjectName(filterSubject) ?? "subject"} <X className="h-3.5 w-3.5" />
          </Link>
        )}
      </header>

      {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Add form — redesigned */}
      <div className="glass space-y-3 p-4">
        <input
          value={form.title}
          onChange={(e) => {
            const title = e.target.value;
            setForm((f) => ({
              ...f,
              title,
              category: categoryTouched ? f.category : recommendCategory(title),
            }));
          }}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Input exams, events, tasks, homework…"
          className={cn(field, "w-full text-base")}
        />
        <div className="flex flex-wrap items-center gap-2">
          <DateTimePicker
            value={form.due}
            onChange={(v) => setForm({ ...form, due: v })}
            className="w-52"
          />
          <Dropdown
            value={form.subjectId}
            options={subjectOpts}
            onChange={(v) => setForm({ ...form, subjectId: v })}
            className="w-44"
          />
          <Dropdown
            value={form.priority}
            options={PRIO_OPTS}
            onChange={(v) => setForm({ ...form, priority: v as TaskPriority })}
            className="w-40"
          />
          <Dropdown
            value={form.category}
            options={CAT_OPTS}
            onChange={(v) => {
              setForm({ ...form, category: v });
              setCategoryTouched(true);
            }}
            className="w-36"
          />
          <button
            onClick={add}
            className="neu-btn ml-auto flex items-center gap-2 px-5 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {/* Exam-conflict defusal — subtle inline warning, not a card */}
      {conflict.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1">
            <span className="font-semibold text-warning">Exam crunch:</span> {conflict.length} assessments within two days
            ({conflict.map((e) => e.title).join(", ")}).
          </p>
          <button
            onClick={() => setShowEmail(true)}
            className="neu-btn shrink-0 rounded-md px-3 py-1 text-xs font-medium"
          >
            Extension email
          </button>
        </div>
      )}

      {/* Grouped list */}
      {visible.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="Nothing scheduled yet">
          {filterSubject
            ? "Nothing for this subject yet."
            : "Add a task or exam above — they power your dashboard's next exam and what's next."}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <FadeIn key={g.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h2
                  className={cn(
                    "text-sm font-semibold",
                    g.key === "overdue" && "text-danger",
                    g.key === "done" && "text-muted",
                  )}
                >
                  {g.label}
                </h2>
                <span className="text-xs tabular-nums text-muted">{g.items.length}</span>
              </div>
              <Stagger className={cn("space-y-2", g.key === "done" && "opacity-60")}>
                <AnimatePresence>
                  {g.items.map((t) => (
                    <StaggerItem key={t.id}>{taskRow(t)}</StaggerItem>
                  ))}
                </AnimatePresence>
              </Stagger>
            </FadeIn>
          ))}
        </div>
      )}

      <Modal open={showEmail} onClose={() => setShowEmail(false)} title="Extension request email">
        <p className="mb-3 text-sm text-muted">
          A professional draft for your professor — copy it, tweak the details, and send.
        </p>
        <textarea
          readOnly
          value={emailText}
          rows={13}
          className="field w-full resize-none rounded-xl p-3 text-sm outline-none"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(emailText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="neu-btn flex items-center gap-2 px-4 py-2 text-sm font-medium"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy email"}
          </button>
        </div>
      </Modal>
    </FadeIn>
  );
}
