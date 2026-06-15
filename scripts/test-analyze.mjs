import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const schema = z.object({
  headline: z.string(),
  points: z.array(z.object({ tone: z.enum(["positive", "warning", "tip"]), text: z.string() })),
});

const data = {
  subject: "Physics I",
  currentGrade: 72,
  target: 85,
  categories: [
    { name: "Continuous Assessment", weight: 60, average: 72, items: [{ title: "Test 1", score: 65, max: 100, weightInCategory: 20 }] },
    { name: "Final Exam", weight: 40, average: null, items: [] },
  ],
};

const { object } = await generateObject({
  model: google("gemini-2.5-flash"),
  schema,
  prompt: "Analyse this student's course performance with specific, honest insights:\n" + JSON.stringify(data),
});

console.log(JSON.stringify(object, null, 2));
