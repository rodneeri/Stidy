import { GradeEngine } from "@/features/grades/GradeEngine";

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  const { import: imp } = await searchParams;
  return <GradeEngine autoImport={imp === "1"} />;
}
