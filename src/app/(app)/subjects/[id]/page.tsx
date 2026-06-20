import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubjectHub } from "@/features/subjects/SubjectHub";
import type { Subject } from "@/types/db";

export default async function SubjectHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("subjects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!subject) notFound();

  const [{ data: logs }, { count: resourceCount }, { data: career }] = await Promise.all([
    supabase.from("study_logs").select("duration_seconds").eq("kind", "focus").eq("subject_id", id),
    supabase.from("resources").select("id", { count: "exact", head: true }).eq("subject_id", id),
    (subject as Subject).career_id
      ? supabase.from("careers").select("name").eq("id", (subject as Subject).career_id!).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const studySeconds = ((logs as { duration_seconds: number }[]) ?? []).reduce(
    (a, r) => a + r.duration_seconds,
    0,
  );

  return (
    <SubjectHub
      subject={subject as Subject}
      studySeconds={studySeconds}
      resourceCount={resourceCount ?? 0}
      careerName={(career as { name: string } | null)?.name ?? null}
    />
  );
}
