import { TasksManager } from "@/features/timetable/TasksManager";

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  return <TasksManager filterSubject={subject ?? null} />;
}
