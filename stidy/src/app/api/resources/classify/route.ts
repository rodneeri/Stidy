import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectAI, aiErrorResponse } from "@/lib/ai/models";

export const maxDuration = 60;

const ClassificationSchema = z.object({
  kind: z
    .enum(["theory", "practice", "exam", "admin", "other"])
    .describe(
      "theory = lecture notes/slides/textbook; practice = problem sets/labs/exercises; " +
        "exam = tests/midterms/finals/past papers; admin = syllabus/schedule/policies; other = anything else",
    ),
  title: z.string().describe("A clean, human-readable title for this resource"),
  summary: z.string().nullable().describe("One short line describing what it is"),
  subject: z
    .string()
    .nullable()
    .describe("The single best-matching subject NAME from the provided list, or null if none clearly fit"),
});

function instruction(subjects: string[]) {
  const base =
    "You are organising a student's study materials. Classify this resource into exactly one " +
    "kind (theory, practice, exam, admin, other), give it a clean title, and a one-line summary.";
  if (subjects.length === 0) return `${base} There are no subjects to match; set subject to null.`;
  return (
    `${base} Then match it to the single best-fitting subject from this list (by topic/course), ` +
    `returning that exact subject name, or null if none clearly fit. Subjects: ${subjects
      .map((s) => `"${s}"`)
      .join(", ")}.`
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  type Part =
    | { type: "text"; text: string }
    | { type: "file"; data: Uint8Array; mediaType: string };
  let content: Part[];

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file" }, { status: 400 });
      }
      const subjects: string[] = JSON.parse((form.get("subjects") as string) || "[]");
      const bytes = new Uint8Array(await file.arrayBuffer());
      content = [
        { type: "text", text: `${instruction(subjects)} Filename: "${file.name}".` },
        { type: "file", data: bytes, mediaType: file.type || "application/pdf" },
      ];
    } else {
      const { filename, mimeType, subjects = [] } = await req.json();
      content = [
        {
          type: "text",
          text: `${instruction(subjects)} Classify from filename + type only. Filename: "${filename}", type: ${mimeType}.`,
        },
      ];
    }

    const object = await generateObjectAI({
      schema: ClassificationSchema,
      messages: [{ role: "user", content }],
      tier: "light",
      groqFallback: true, // gated off automatically when the request has a file (vision)
      maxWaitSec: 0,
    });
    return NextResponse.json(object);
  } catch (err) {
    const { status, body } = aiErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
