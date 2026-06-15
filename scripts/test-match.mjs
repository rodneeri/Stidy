import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const schema = z.object({
  kind: z.enum(["theory", "practice", "exam", "admin", "other"]),
  title: z.string(),
  summary: z.string().nullable(),
  subject: z.string().nullable(),
});

const subjects = ["Calculus II", "Physics I — Mechanics", "Data Structures"];
const files = ["Calc2_Midterm.pdf", "Mechanics_Lecture5_friction.pdf", "BinaryTrees_problemset.pdf", "random_meme.png"];

for (const filename of files) {
  const { object } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema,
    prompt: `Classify (theory/practice/exam/admin/other) and match to ONE subject from [${subjects.map((s) => `"${s}"`).join(", ")}] or null. Filename: "${filename}".`,
  });
  console.log(`${filename.padEnd(34)} → ${object.kind.padEnd(9)} | subject: ${object.subject ?? "none"}`);
}
