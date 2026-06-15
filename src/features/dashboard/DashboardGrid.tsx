"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  TrendingUp,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ArrowUpRight,
  Timer,
  Clock,
  Quote,
  Sliders,
  Plus,
  X,
  Check,
  GripVertical,
  Sparkles,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Dial } from "@/components/ui/Dial";
import { useGradeScale, formatGrade, type GradeScale } from "@/lib/grade-scale";
import { useSubjectIcons } from "@/lib/subject-icons";
import { reveal, staggerParent, staggerChild } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface DashData {
  firstName: string;
  subjects: { id: string; name: string; current_grade: number | null; color: string | null }[];
  tasks: { id: string; title: string; due_at: string | null; is_exam: boolean }[];
  avg: number | null;
  gradedCount: number;
  nextExam: { title: string; due_at: string | null } | null;
  weekFocusSec: number;
}

const KEY = "stidy-dashboard-v3";
const DIAL_COLORS = ["var(--color-primary)", "var(--color-secondary)", "var(--color-accent)"];
// Column spans clamp to the grid (max 4 on desktop) so nothing ever overflows.
const SPAN: Record<number, string> = {
  1: "",
  2: "sm:col-span-2 lg:col-span-2",
  4: "sm:col-span-2 lg:col-span-4",
};
const SIZES: { span: number; label: string }[] = [
  { span: 1, label: "S" },
  { span: 2, label: "M" },
  { span: 4, label: "L" },
];

type Item = { id: string; span: number };

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof TrendingUp;
  href: string;
}) {
  return (
    <Link href={href} className="glass lift block h-full p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 truncate text-xs text-muted">{sub}</p>
    </Link>
  );
}

function countdown(iso: string | null): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const d = Math.floor(diff / 86400000);
  if (d >= 1) return `${d}d`;
  return `${Math.floor(diff / 3600000)}h`;
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="glass flex h-full flex-col justify-center p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Clock</span>
        <Clock className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">
        {now ? now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "--:--"}
      </p>
      <p className="text-xs text-muted">
        {now ? now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }) : ""}
      </p>
    </div>
  );
}

const QUOTES = [
  "Small steps every day beat big steps someday.",
  "You don't have to be perfect — just consistent.",
  "Future you is built by present you. Keep going.",
  "Done is better than perfect.",
  "Focus on the next 25 minutes, not the whole syllabus.",
];
function QuoteWidget() {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(Math.floor(Math.random() * QUOTES.length));
    const id = setInterval(() => setI((x) => (x + 1) % QUOTES.length), 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="glass flex h-full flex-col justify-center gap-2 p-5">
      <Quote className="h-5 w-5 text-primary" />
      <p className="text-sm font-medium leading-relaxed">{QUOTES[i]}</p>
    </div>
  );
}

const TIPS = [
  "Quack! Teach the topic out loud — if you can explain it, you know it.",
  "Quack! Hardest task first, while your brain is fresh.",
  "Quack! A 5-minute walk counts — memory consolidates on breaks.",
  "Quack! Re-do a past exam under time pressure.",
  "Quack! Hydrate. Seriously.",
];
function DuckWidget() {
  const [i, setI] = useState(0);
  useEffect(() => setI(Math.floor(Math.random() * TIPS.length)), []);
  return (
    <button
      onClick={() => setI((x) => (x + 1) % TIPS.length)}
      className="glass lift flex h-full flex-col justify-center gap-2 p-5 text-left"
    >
      <span className="text-3xl">🦆</span>
      <p className="text-xs text-muted">{TIPS[i]}</p>
    </button>
  );
}

function Notepad() {
  const [text, setText] = useState("");
  useEffect(() => {
    try {
      setText(localStorage.getItem("stidy-notepad") ?? "");
    } catch {
      /* ignore */
    }
  }, []);
  return (
    <div className="glass flex h-full flex-col p-5">
      <p className="mb-2 text-sm font-semibold">Scratchpad</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            localStorage.setItem("stidy-notepad", e.target.value);
          } catch {
            /* ignore */
          }
        }}
        placeholder="Jot anything…"
        className="field flex-1 resize-none rounded-lg p-3 text-sm outline-none"
      />
    </div>
  );
}

function ProgressRing({ sec }: { sec: number }) {
  const goal = 10 * 3600;
  const pct = Math.min((sec / goal) * 100, 100);
  return (
    <div className="glass flex h-full items-center gap-4 p-5">
      <Dial
        value={pct}
        size={64}
        stroke={7}
        className="shrink-0"
        center={<span className="text-xs font-semibold tabular-nums">{pct.toFixed(0)}%</span>}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold">Weekly goal</p>
        <p className="text-xs text-muted tabular-nums">
          {(sec / 3600).toFixed(1)} / 10h focused
        </p>
      </div>
    </div>
  );
}

/**
 * Subject grade dials. Icons come from `useSubjectIcons()` (not a render-time
 * localStorage read) so server and first client render agree — no hydration
 * mismatch — then the saved emoji fills in after mount.
 */
function SubjectDials({ d, scale }: { d: DashData; scale: GradeScale }) {
  const icons = useSubjectIcons();
  return (
    <Link href="/grades" className="glass lift block h-full p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-semibold">Subjects</h2>
        <ArrowUpRight className="h-4 w-4 text-muted" />
      </div>
      {d.subjects.length === 0 ? (
        <div className="grid min-h-[120px] place-items-center text-center text-sm text-muted">No subjects yet.</div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {d.subjects.slice(0, 3).map((sub, i) => {
            const g = sub.current_grade == null ? null : Number(sub.current_grade);
            return (
              <div key={sub.id} className="flex flex-col items-center text-center">
                <Dial
                  value={g ?? 0}
                  size={96}
                  accent={DIAL_COLORS[i % 3]}
                  center={
                    <span className="text-lg font-semibold tabular-nums">
                      {formatGrade(g, scale, { suffix: false, decimals: scale === "percent" ? 0 : 1 })}
                    </span>
                  }
                />
                <p className="mt-2 max-w-full truncate text-xs font-medium">
                  {icons[sub.id] ? `${icons[sub.id]} ` : ""}
                  {sub.name}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}

interface Widget {
  id: string;
  label: string;
  category: "useful" | "fun";
  defaultSpan: number;
  render: (d: DashData, scale: GradeScale) => ReactNode;
}

const WIDGETS: Widget[] = [
  { id: "avg", label: "Weighted average", category: "useful", defaultSpan: 1, render: (d, scale) => <StatCard label="Weighted Avg" value={formatGrade(d.avg, scale)} sub={d.gradedCount ? `across ${d.gradedCount} subjects` : "no grades yet"} icon={TrendingUp} href="/grades" /> },
  { id: "subjects", label: "Subject count", category: "useful", defaultSpan: 1, render: (d) => <StatCard label="Subjects" value={String(d.subjects.length)} sub={d.subjects.length ? "tracked" : "add your first"} icon={BookOpen} href="/subjects" /> },
  { id: "nextExam", label: "Next exam countdown", category: "useful", defaultSpan: 1, render: (d) => <StatCard label="Next Exam" value={d.nextExam ? countdown(d.nextExam.due_at) : "—"} sub={d.nextExam ? d.nextExam.title : "none scheduled"} icon={CalendarClock} href="/timetable" /> },
  { id: "tasks", label: "Open tasks", category: "useful", defaultSpan: 1, render: (d) => <StatCard label="Tasks" value={String(d.tasks.length)} sub={d.tasks.length ? "upcoming" : "all clear"} icon={CheckCircle2} href="/timetable" /> },
  { id: "progress", label: "Weekly focus goal", category: "useful", defaultSpan: 1, render: (d) => <ProgressRing sec={d.weekFocusSec} /> },
  {
    id: "dials",
    label: "Subject grade dials",
    category: "useful",
    defaultSpan: 2,
    render: (d, scale) => <SubjectDials d={d} scale={scale} />,
  },
  {
    id: "upcoming",
    label: "What's next",
    category: "useful",
    defaultSpan: 2,
    render: (d) => (
      <Link href="/timetable" className="glass lift block h-full p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">What&apos;s next</h2>
          <ArrowUpRight className="h-4 w-4 text-muted" />
        </div>
        {d.tasks.length === 0 ? (
          <div className="grid min-h-[120px] place-items-center text-center text-sm text-muted">Nothing due.</div>
        ) : (
          <ul className="space-y-3">
            {d.tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    {t.due_at ? new Date(t.due_at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "No date"}
                    {t.is_exam && " · Exam"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Link>
    ),
  },
  {
    id: "focus",
    label: "This week's focus",
    category: "useful",
    defaultSpan: 2,
    render: (d) => (
      <Link href="/focus" className="glass lift flex h-full items-center gap-4 p-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Timer className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">This week&apos;s focus</h2>
          <p className="text-sm text-muted tabular-nums">{(d.weekFocusSec / 3600).toFixed(1)} h logged — start a session</p>
        </div>
        <ArrowUpRight className="ml-auto h-4 w-4 text-muted" />
      </Link>
    ),
  },
  { id: "quote", label: "Motivational quote", category: "fun", defaultSpan: 2, render: () => <QuoteWidget /> },
  { id: "clock", label: "Live clock", category: "fun", defaultSpan: 1, render: () => <LiveClock /> },
  { id: "duck", label: "Study buddy 🦆", category: "fun", defaultSpan: 1, render: () => <DuckWidget /> },
  { id: "notepad", label: "Scratchpad", category: "fun", defaultSpan: 2, render: () => <Notepad /> },
];

const widgetById = (id: string) => WIDGETS.find((w) => w.id === id);
const DEFAULTS: Item[] = ["avg", "subjects", "nextExam", "tasks", "dials", "upcoming", "focus"].map((id) => ({
  id,
  span: widgetById(id)!.defaultSpan,
}));

/**
 * A widget in edit mode — the real card, draggable in place on the grid via
 * dnd-kit (FLIP-animated, spanning-grid aware). Floating control: drag / size / remove.
 */
function SortableCard({
  item,
  data,
  scale,
  onSize,
  onRemove,
}: {
  item: Item;
  data: DashData;
  scale: GradeScale;
  onSize: (span: number) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const w = widgetById(item.id);
  if (!w) return null;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative touch-none", SPAN[item.span] || undefined, isDragging && "z-50")}
    >
      <div
        className={cn(
          "relative rounded-2xl ring-2 ring-transparent transition-shadow",
          isDragging ? "shadow-2xl ring-primary/40" : "ring-border/50",
        )}
      >
        {/* floating edit control */}
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-1 py-1 backdrop-blur">
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag widget"
            className="grid h-6 w-6 cursor-grab touch-none place-items-center rounded-full text-muted hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {SIZES.map((s) => (
            <button
              key={s.span}
              onClick={() => onSize(s.span)}
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold",
                item.span === s.span ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={onRemove}
            aria-label="Remove widget"
            className="grid h-6 w-6 place-items-center rounded-full text-danger hover:bg-danger/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="pointer-events-none select-none">{w.render(data, scale)}</div>
      </div>
    </div>
  );
}

export function DashboardGrid({ data }: { data: DashData }) {
  const scale = useGradeScale((s) => s.scale);
  const [items, setItemsState] = useState<Item[]>(DEFAULTS);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setItemsState(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, []);

  function setItems(next: Item[]) {
    setItemsState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  const setSize = (id: string, span: number) =>
    setItems(items.map((i) => (i.id === id ? { ...i, span } : i)));
  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from !== -1 && to !== -1) setItems(arrayMove(items, from, to));
  };
  const addItem = (id: string) => setItems([...items, { id, span: widgetById(id)!.defaultSpan }]);

  const available = WIDGETS.filter((w) => !items.some((i) => i.id === w.id));

  return (
    <div className="space-y-6">
      <motion.div
        variants={reveal}
        initial="hidden"
        animate="show"
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="eyebrow mb-1.5">Good to see you, {data.firstName}</p>
          <h1 className="display-2">
            Your <span className="text-gradient">command center</span>
          </h1>
        </div>
        <div className="flex gap-2">
          {editing && (
            <button onClick={() => setAddOpen(true)} className="neu-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium">
              <Plus className="h-4 w-4" /> Add widget
            </button>
          )}
          <button
            onClick={() => setEditing((v) => !v)}
            className="neu-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
          >
            {editing ? <Check className="h-4 w-4" /> : <Sliders className="h-4 w-4" />}
            {editing ? "Done" : "Customize"}
          </button>
        </div>
      </motion.div>

      {editing && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-muted">
          Drag the handle to reorder · S / M / L sets the width · ✕ removes · “Add widget” for more.
        </p>
      )}

      {data.subjects.length === 0 ? (
        <Link href="/grades?import=1" className="glass lift block p-8 text-center">
          <div className="mx-auto max-w-md space-y-3">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold">Welcome to STiDY</h2>
            <p className="text-sm text-muted">
              Drop your class syllabus PDFs and STiDY sets up your subjects, grade weights and
              dashboard automatically — in seconds.
            </p>
            <span className="neu-btn inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium">
              Import a syllabus →
            </span>
          </div>
        </Link>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No widgets — hit Customize → Add widget.</p>
      ) : editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-flow-row-dense gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((it) => (
                <SortableCard
                  key={it.id}
                  item={it}
                  data={data}
                  scale={scale}
                  onSize={(span) => setSize(it.id, span)}
                  onRemove={() => removeItem(it.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="grid grid-flow-row-dense gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {items.map((it) => {
            const w = widgetById(it.id);
            if (!w) return null;
            return (
              <motion.div
                key={it.id}
                layout
                variants={staggerChild}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className={SPAN[it.span] || undefined}
              >
                {w.render(data, scale)}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a widget">
        {available.length === 0 ? (
          <p className="text-sm text-muted">Every widget is already on your dashboard.</p>
        ) : (
          <div className="space-y-1">
            {available.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  addItem(w.id);
                  setAddOpen(false);
                }}
                className="pressable flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:text-primary"
              >
                <span>{w.label}</span>
                <span className="text-xs text-muted capitalize">{w.category}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
