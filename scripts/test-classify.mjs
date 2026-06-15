import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const schema = z.object({
  kind: z.enum(["theory", "practice", "exam", "admin", "other"]),
  title: z.string(),
  summary: z.string().nullable(),
});

const names = ["Midterm_2024_solutions.pdf", "Lecture3_Thermodynamics.pdf", "ProblemSet_Lab2.pdf", "Course_Syllabus_Spring.pdf"];
for (const filename of names) {
  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema,
    prompt: `Classify this student resource (theory/practice/exam/admin/other) from its filename: "${filename}". Give a clean title and one-line summary.`,
  });
  console.log(`${filename.padEnd(32)} → ${object.kind}`);
}
