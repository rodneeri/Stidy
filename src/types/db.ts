/** Hand-written domain types mirroring the Supabase schema (supabase/schema.sql). */

export interface Subject {
  id: string;
  user_id: string;
  career_id: string | null;
  name: string;
  code: string | null;
  professor: string | null;
  semester: string | null;
  /** Emoji icon persisted on the row (mirrors the local icon store). */
  icon?: string | null;
  /** Academic year within the career (1, 2, 3…). */
  year?: number | null;
  /** Term index within the year (1, 2, 3…). */
  term?: number | null;
  credits?: number | null;
  color: string | null;
  current_grade: number | null;
}

export type CareerKind = "degree" | "bachillerato" | "oposicion" | "other";
export type TermSystem = "semester" | "cuatrimestre" | "trimestre" | "year";

export interface Career {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  kind: CareerKind;
  country: string | null;
  term_system: TermSystem;
  start_year: number | null;
  color: string | null;
  icon: string | null;
  position?: number | null;
}

/** An official exam taken outside the course (EVAU, oposición exam…). */
export interface ExternalExam {
  id: string;
  user_id: string;
  career_id: string | null;
  name: string;
  score: number | null;
  max_score: number;
  weight: number | null;
  exam_date: string | null;
  meta: Record<string, unknown>;
}

export type GoalKind = "admission" | "oposicion" | "other";

/** A cross-country aspiration: uni admission (nota de corte), oposición, etc. */
export interface Goal {
  id: string;
  user_id: string;
  kind: GoalKind;
  country: string | null;
  title: string;
  institution: string | null;
  target_score: number | null;
  score_scale: number | null;
  source_url: string | null;
  year: number | null;
  meta: Record<string, unknown>;
}

/** A weighting bucket stored inside grading_structures.categories (JSONB). */
export interface Category {
  id: string;
  name: string;
  weight: number;
  drop_lowest?: number;
  /** Optional direct grade for the whole category — overrides its items when set. */
  grade?: number | null;
}

export interface GradingStructure {
  id: string;
  subject_id: string;
  categories: Category[];
  pass_mark: number | null;
  target_grade: number | null;
}

export type TaskStatus = "todo" | "in_progress" | "done" | "archived";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  is_exam: boolean;
  /** Kind of item: task | homework | exam | quiz | event | class | lab | project | reading | deadline */
  category?: string | null;
  location: string | null;
}

export interface Flashcard {
  id: string;
  user_id: string;
  subject_id: string | null;
  front: string;
  back: string;
  due_date: string;
  source: string | null;
  ease_factor?: number;
  interval_days?: number;
  repetitions?: number;
}

export type ResourceKind = "theory" | "practice" | "exam" | "admin" | "other";

export interface Resource {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  kind: ResourceKind;
  source: "upload" | "link";
  storage_path: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  meta: { summary?: string } | null;
  created_at: string;
}

export interface Grade {
  id: string;
  subject_id: string;
  category_id: string;
  title: string;
  score: number | null;
  max_score: number;
  /** Optional weight of this item *within* its category (relative; normalised). */
  weight: number | null;
  is_projected: boolean;
  graded_at: string | null;
}

// ── Coworking / Collaboration Hub ───────────────────────────────────────────
export type CoworkTimerPhase = "idle" | "focus" | "break";

export interface CoworkRoom {
  id: string;
  owner_id: string;
  name: string;
  join_code: string;
  is_private: boolean;
  timer_phase: CoworkTimerPhase;
  timer_started_at: string | null;
  timer_duration_secs: number;
  created_at: string;
  updated_at: string;
}

export interface CoworkMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface CoworkMessage {
  id: string;
  room_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}
