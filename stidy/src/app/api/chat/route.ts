import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTextAI, aiErrorResponse } from "@/lib/ai/models";
import { isValidModel } from "@/lib/ai/catalog";

export const maxDuration = 60;

interface Cat {
  id: string;
  name: string;
  weight: number;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages, model } = await req.json();

  const [subjectsRes, structRes, gradesRes, tasksRes, resourcesRes] = await Promise.all([
    supabase.from("subjects").select("id, name, code, professor, current_grade").is("parent_id", null),
    supabase.from("grading_structures").select("subject_id, categories"),
    supabase.from("grades").select("subject_id, category_id, title, score, max_score, weight"),
    supabase
      .from("tasks")
      .select("title, due_at, is_exam, category, subject_id")
      .neq("status", "done")
      .order("due_at"),
    supabase.from("resources").select("title, kind, subject_id, url, meta"),
  ]);

  const subjects = subjectsRes.data ?? [];
  const structures = (structRes.data ?? []) as { subject_id: string; categories: Cat[] }[];
  const grades =
    (gradesRes.data ?? []) as {
      subject_id: string;
      title: string;
      score: number | null;
      max_score: number;
      weight: number | null;
    }[];
  const tasks =
    (tasksRes.data ?? []) as {
      title: string;
      due_at: string | null;
      is_exam: boolean;
      category: string | null;
      subject_id: string | null;
    }[];
  const resources =
    (resourcesRes.data ?? []) as {
      title: string;
      kind: string;
      subject_id: string | null;
      url: string | null;
      meta: { summary?: string } | null;
    }[];
  const nameOf = (id: string | null) => subjects.find((s) => s.id === id)?.name ?? "";

  const subjList =
    subjects
      .map((s) => {
        const cats = structures.find((st) => st.subject_id === s.id)?.categories ?? [];
        const catStr = cats.map((c) => `${c.name} ${c.weight}%`).join(", ");
        const gs = grades
          .filter((g) => g.subject_id === s.id)
          .map((g) => `${g.title}: ${g.score ?? "—"}/${g.max_score}${g.weight ? ` (${g.weight}% of cat)` : ""}`)
          .join("; ");
        return `- ${s.name}${s.code ? ` (${s.code})` : ""}${s.professor ? `, prof. ${s.professor}` : ""} — current grade ${
          s.current_grade ?? "—"
        }%. Categories: ${catStr || "none"}. Grades: ${gs || "none"}.`;
      })
      .join("\n") || "none";

  const taskList =
    tasks
      .map(
        (t) =>
          `- ${t.title} [${t.category ?? (t.is_exam ? "exam" : "task")}]${
            t.subject_id ? ` · ${nameOf(t.subject_id)}` : ""
          }${t.due_at ? ` · due ${new Date(t.due_at).toDateString()}` : ""}`,
      )
      .join("\n") || "none";

  const resList =
    resources
      .map(
        (r) =>
          `- ${r.title} (${r.kind}${r.subject_id ? `, ${nameOf(r.subject_id)}` : ""})${
            r.url ? ` [${r.url}]` : ""
          }${r.meta?.summary ? `\n    summary: ${r.meta.summary}` : ""}`,
      )
      .join("\n") || "none";

  const system =
    "You are STiDY's study assistant for ONE specific student. Use the data below to answer questions " +
    "about their semester — grades, weights, deadlines, exams, materials. Be concise, warm and practical; " +
    "do real arithmetic when asked (e.g. what they need to score). When relevant, draw on the resource " +
    "summaries below and point the student to the specific material (by title) that helps. " +
    "If something isn't in the data, say so. " +
    `Today is ${new Date().toDateString()}.\n\n` +
    `=== SUBJECTS & GRADES ===\n${subjList}\n\n=== UPCOMING TASKS & EXAMS ===\n${taskList}\n\n=== RESOURCES ===\n${resList}`;

  try {
    const result = await generateTextAI({
      system,
      messages,
      tier: "heavy",
      groqFallback: true,
      maxWaitSec: 30,
      nvidiaModel: isValidModel(model) ? model : undefined,
    });
    return NextResponse.json({ text: result.text, model: result.model });
  } catch (err) {
    const { status, body } = aiErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
