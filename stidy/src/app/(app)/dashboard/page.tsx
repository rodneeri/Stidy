import { createClient } from "@/lib/supabase/server";
import type { Subject } from "@/types/db";
import { DashboardGrid, type DashData } from "@/features/dashboard/DashboardGrid";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const firstName = ((user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "there").split(
    /[ @]/,
  )[0];

  const weekAgo = new Date();
  weekAgo.setHours(0, 0, 0, 0);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const [{ data: subjectsRaw }, { data: tasksRaw }, { data: logsRaw }] = await Promise.all([
    supabase.from("subjects").select("*").is("parent_id", null).order("created_at"),
    supabase
      .from("tasks")
      .select("*")
      .neq("status", "done")
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("study_logs")
      .select("duration_seconds")
      .eq("kind", "focus")
      .gte("started_at", weekAgo.toISOString()),
  ]);

  const subjects = (subjectsRaw as Subject[]) ?? [];
  const tasks =
    (tasksRaw as { id: string; title: string; due_at: string | null; is_exam: boolean }[]) ?? [];
  const graded = subjects.filter((s) => s.current_grade != null);
  const avg = graded.length
    ? graded.reduce((a, s) => a + Number(s.current_grade), 0) / graded.length
    : null;
  const nextExam = tasks.find((t) => t.is_exam && t.due_at) ?? null;
  const weekFocusSec = ((logsRaw as { duration_seconds: number }[]) ?? []).reduce(
    (a, l) => a + l.duration_seconds,
    0,
  );

  const data: DashData = {
    firstName,
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      current_grade: s.current_grade,
      color: s.color,
    })),
    tasks,
    avg,
    gradedCount: graded.length,
    nextExam: nextExam ? { title: nextExam.title, due_at: nextExam.due_at } : null,
    weekFocusSec,
  };

  return <DashboardGrid data={data} />;
}
