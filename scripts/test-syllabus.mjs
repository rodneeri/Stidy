import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  code: z.string().nullable(),
  professor: z.string().nullable(),
  categories: z.array(
    z.object({
      name: z.string(),
      weight: z.number(),
      items: z.array(z.object({ name: z.string(), weight: z.number() })),
    }),
  ),
});

const sample = `COURSE SYLLABUS — Physics I (PHYS 101), Prof. Alan Turing

GRADING POLICY
1. Continuous Assessment — 60% of the final grade, broken down as:
     • Test 1 ............ 20% (of the continuous assessment)
     • Test 2 ............ 20%
     • Lab reports ....... 35%
     • Quizzes ........... 25%
2. Final Examination — 40% of the final grade.`;

const { object } = await generateObject({
  model: google("gemini-2.5-flash"),
  schema,
  prompt:
    "Parse this syllabus. Top-level category weights are % of the FINAL grade. " +
    "Sub-item weights are % WITHIN their category. If a category has no sub-items, use an empty array.\n\n" +
    sample,
});

console.log(JSON.stringify(object, null, 2));
