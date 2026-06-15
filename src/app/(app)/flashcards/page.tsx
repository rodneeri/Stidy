import { StudyLab } from "@/features/studylab/StudyLab";

export default async function StudyLabPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  return <StudyLab initialSubject={subject ?? null} />;
}
