import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateJsonAI, aiErrorResponse } from "@/lib/ai/models";
import { buildResourceContext } from "@/lib/ai/resource-content";
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

// Solver mode: one problem statement in, a verified step-by-step solution out.
const SolverSchema = z.object({
  steps: z
    .array(
      z.object({
        heading: z.string().nullable().describe("Short label for the step, or null"),
        detail: z.string().describe("The reasoning for this step, with LaTeX maths"),
      }),
    )
    .describe("Ordered solution steps, each explained"),
  answer: z.string().describe("The final answer, stated clearly"),
});

export async function POST(req: Request) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subjectId, type, difficulty, count, customPrompt, model, problem, resourceIds } =
    await req.json();
  const preferred = isValidModel(model) ? model : undefined;

  // Ground the generation in the subject + the ACTUAL text of its filed resources
  // (not just titles), so it can genuinely study/solve from the materials.
  const { data: subject } = await supabase
    .from("subjects")
    .select("name, code")
    .eq("id", subjectId)
    .maybeSingle();
  const subjectName = subject?.name ?? "this course";
  const materials = await buildResourceContext(supabase, {
    subjectId,
    resourceIds: Array.isArray(resourceIds) ? resourceIds : undefined,
  });

  // Solver mode: no difficulty/count — a fixed problem statement to work through.
  if (type === "solver") {
    const statement = String(problem ?? "").trim();
    if (!statement) {
      return NextResponse.json({ error: "Add the problem you want solved." }, { status: 400 });
    }
    const solverPrompt =
      `You are an expert tutor for "${subjectName}". Solve the problem below and ` +
      `SHOW EVERY STEP so a student can follow and learn the method. Be rigorous: ` +
      `state assumptions, justify each step, and double-check the final answer. ` +
      `Where the course materials imply a specific method, use that method. ` +
      `Format ALL mathematics as LaTeX: $...$ inline and $$...$$ displayed.\n` +
      (customPrompt ? `Extra instructions from the student: ${customPrompt}\n` : "") +
      `\nProblem to solve:\n${statement}\n` +
      `\nCourse materials for context:\n${materials}`;
    const object = await generateJsonAI({
      schema: SolverSchema,
      prompt: solverPrompt,
      jsonShape: `{ "steps": [ { "heading": "short label or null", "detail": "explanation with LaTeX maths" } ], "answer": "the final answer" }`,
      preferred,
    });
    return NextResponse.json({ type, ...object });
  }

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

    if (type === "flashcards") {
      const object = await generateJsonAI({
        schema: FlashcardsSchema,
        prompt,
        jsonShape: `{ "cards": [ { "front": "question text", "back": "answer text" } ] }  // exactly ${n} cards`,
        preferred,
      });
      return NextResponse.json({ type, ...object });
    }
    const object = await generateJsonAI({
      schema: ExamSchema,
      prompt,
      jsonShape: `{ "questions": [ { "question": "text", "answer": "full worked solution", "points": number or null } ] }  // exactly ${n} questions`,
      preferred,
    });
    return NextResponse.json({ type, ...object });
  } catch (err) {
    const { status, body } = aiErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
