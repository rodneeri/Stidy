"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  LayoutGrid,
  FolderOpen,
  FlaskConical,
  CalendarDays,
  GraduationCap,
  Timer,
  Clock,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import type { Subject } from "@/types/db";
import { useGradeScale, formatGrade } from "@/lib/grade-scale";
import { useSubjectIcons } from "@/lib/subject-icons";
import { useFocusStore } from "@/stores/focus-store";
import { ResourcesManager } from "@/features/resources/ResourcesManager";
import { StudyLab } from "@/features/studylab/StudyLab";
import { TasksManager } from "@/features/timetable/TasksManager";
import { FocusTimer } from "@/features/focus/FocusTimer";
import { cn } from "@/lib/utils";

type Tab = "overview" | "resources" | "studylab" | "timetable" | "grades" | "focus";

const TABS: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "resources", label: "Resources", icon: FolderOpen },
  { id: "studylab", label: "Study Lab", icon: FlaskConical },
  { id: "timetable", label: "Timetable", icon: CalendarDays },
  { id: "grades", label: "Grades", icon: GraduationCap },
  { id: "focus", label: "Focus", icon: Timer },
];

const studyHrs = (s: number) => (s >= 36000 ? `${Math.round(s / 3600)}h` : `${(s / 3600).toFixed(1)}h`);

export function SubjectHub({
  subject,
  studySeconds,
  resourceCount,
  careerName,
}: {
  subject: Subject;
  studySeconds: number;
  resourceCount: number;
  careerName: string | null;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const scale = useGradeScale((s) => s.scale);
  const icons = useSubjectIcons();
  const setFocusSubject = useFocusStore((s) => s.setSubjectId);
  const color = subject.color ?? "#14b8a6";
  const icon = icons[subject.id];
  const meta = [subject.code, subject.professor].filter(Boolean).join(" · ");

  // Pre-select this subject in the Focus "log to" target when the tab opens.
  useEffect(() => {
    if (tab === "focus") setFocusSubject(subject.id);
  }, [tab, subject.id, setFocusSubject]);

  return (
    <div className="space-y-6">
      {/* Classroom-style banner */}
      <div className="glass relative overflow-hidden p-0">
        <div
          className="h-28 w-full sm:h-32"
          style={{ background: `linear-gradient(120deg, ${color}, ${color}33)` }}
        />
        <Link
          href="/subjects"
          className="pressable absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-background/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Subjects
        </Link>
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-6">
          <span
            className="-mt-9 grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-white shadow-lg ring-4 ring-[hsl(var(--surface))]"
            style={{ background: color }}
          >
            {icon ? <span className="text-3xl leading-none">{icon}</span> : <BookOpen className="h-7 w-7" />}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="display-3 truncate">{subject.name}</h1>
            <p className="truncate text-sm text-muted">
              {[careerName, meta].filter(Boolean).join(" · ") || "No details yet"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted">Grade</p>
              <p className="text-xl font-semibold tabular-nums">
                {formatGrade(subject.current_grade == null ? null : Number(subject.current_grade), scale)}
              </p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-xs text-muted">
                <Clock className="h-3 w-3" /> Studied
              </p>
              <p className="text-xl font-semibold tabular-nums">{studyHrs(studySeconds)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "pressable relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
              tab === id ? "text-primary" : "text-muted hover:text-foreground",
            )}
          >
            {tab === id && (
              <motion.span layoutId="hub-tab" className="neu absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
            )}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content — only the active tab mounts */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "overview" && (
            <Overview
              subject={subject}
              scale={scale}
              studySeconds={studySeconds}
              resourceCount={resourceCount}
              onGo={setTab}
            />
          )}
          {tab === "resources" && <ResourcesManager initialSubject={subject.id} />}
          {tab === "studylab" && <StudyLab initialSubject={subject.id} />}
          {tab === "timetable" && <TasksManager filterSubject={subject.id} />}
          {tab === "grades" && <GradesPanel subject={subject} scale={scale} />}
          {tab === "focus" && <FocusTimer />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <div className="glass flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function Overview({
  subject,
  scale,
  studySeconds,
  resourceCount,
  onGo,
}: {
  subject: Subject;
  scale: ReturnType<typeof useGradeScale.getState>["scale"];
  studySeconds: number;
  resourceCount: number;
  onGo: (t: Tab) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Current grade"
          value={formatGrade(subject.current_grade == null ? null : Number(subject.current_grade), scale)}
          icon={GraduationCap}
        />
        <StatTile label="Time studied" value={studyHrs(studySeconds)} icon={Clock} />
        <StatTile label="Resources" value={String(resourceCount)} icon={FolderOpen} />
        <StatTile label="Term" value={subject.semester?.toString().trim() || "—"} icon={CalendarDays} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TABS.filter((t) => t.id !== "overview").map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onGo(id)}
            className="glass group flex items-center justify-between gap-3 p-4 text-left hover:text-primary"
          >
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary/15 text-secondary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{label}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Grades tab — subject grade summary + a jump into the full Grade Engine. */
function GradesPanel({
  subject,
  scale,
}: {
  subject: Subject;
  scale: ReturnType<typeof useGradeScale.getState>["scale"];
}) {
  return (
    <div className="glass space-y-4 p-6">
      <div>
        <p className="text-xs text-muted">Current grade</p>
        <p className="display-3 tabular-nums">
          {formatGrade(subject.current_grade == null ? null : Number(subject.current_grade), scale)}
        </p>
      </div>
      <p className="text-sm text-muted">
        Edit weights, categories, and marks for {subject.name} in the Grade Engine.
      </p>
      <Link
        href="/grades"
        className="neu-btn inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary"
      >
        Open Grade Engine <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
