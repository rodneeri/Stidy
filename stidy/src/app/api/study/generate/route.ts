import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectAI, aiErrorResponse } from "@/lib/ai/models";
import { isValidModel } from "@/lib/ai/catalog";

export const maxDuration = 60;

const FlashcardsSchema = z.object({
  cards: z
    .array(z.object({ front: z.string(), back: z.string() }))
    .describe("Question/prompt on the front, the answer/explanation on the back"),
});

const ExamSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string().describe("Full answer or worked solution (show steps for maths)"),
        points: z.number().nullable(),
      }),
    )
    .describe("Exam questions with model answers"),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subjectId, type, difficulty, count, customPrompt, model } = await req.json();
  const nvidiaModel = isValidModel(model) ? model : undefined;

  // Ground the generation in the subject + its filed resources.
  const [{ data: subject }, { data: resources }] = await Promise.all([
    supabase.from("subjects").select("name, code").eq("id", subjectId).maybeSingle(),
    supabase
      .from("resources")
      .select("title, kind, meta")
      .eq("subject_id", subjectId)
      .limit(40),
  ]);

  const subjectName = subject?.name ?? "this course";
  const materials =
    (resources ?? [])
      .map(
        (r: { title: string; kind: string; meta: { summary?: string } | null }) =>
          `- [${r.kind}] ${r.title}${r.meta?.summary ? ` — ${r.meta.summary}` : ""}`,
      )
      .join("\n") || "(no uploaded materials yet)";

  const n = Math.min(Math.max(Number(count) || 8, 1), 30);
  const kindLine =
    type === "flashcards"
      ? `Create ${n} study flashcards.`
      : type === "practical"
        ? `Create a ${n}-question PRACTICAL exam: problem-solving questions (e.g. maths/physics) with full worked solutions.`
        : `Create a ${n}-question WRITTEN exam: conceptual/short-answer questions with model answers.`;

  const prompt =
    `You are an expert tutor for "${subjectName}". ${kindLine} ` +
    `Difficulty: ${difficulty}. Cover the topics implied by the course materials below; ` +
    `be accurate and self-contained. ` +
    `Format ALL mathematics as LaTeX: $...$ for inline and $$...$$ for displayed equations ` +
    `(use \\frac, \\int, \\sum, \\sqrt, ^, _, Greek letters, etc.). Do not escape the dollar signs.\n` +
    (customPrompt ? `Extra instructions from the student: ${customPrompt}\n` : "") +
    `\nCourse materials for context:\n${materials}`;

  try {
    if (type === "flashcards") {
      const object = await generateObjectAI({
        schema: FlashcardsSchema,
        prompt,
        tier: "heavy",
        groqFallback: true,
        maxWaitSec: 30,
        nvidiaModel,
      });
      return NextResponse.json({ type, ...object });
    }
    const object = await generateObjectAI({
      schema: ExamSchema,
      prompt,
      tier: "heavy",
      groqFallback: true,
      maxWaitSec: 30,
      nvidiaModel,
    });
    return NextResponse.json({ type, ...object });
  } catch (err) {
    const { status, body } = aiErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
