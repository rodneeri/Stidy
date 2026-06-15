import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const cards = z.object({ cards: z.array(z.object({ front: z.string(), back: z.string() })) });
const exam = z.object({
  questions: z.array(z.object({ question: z.string(), answer: z.string(), points: z.number().nullable() })),
});

const fc = await generateObject({
  model: google("gemini-2.5-flash"),
  schema: cards,
  prompt: "Create 3 medium flashcards for Calculus II (focus: integration by parts).",
});
console.log("FLASHCARDS:");
fc.object.cards.forEach((c) => console.log(`  Q: ${c.front}\n  A: ${c.back}\n`));

const ex = await generateObject({
  model: google("gemini-2.5-flash"),
  schema: exam,
  prompt: "Create a 2-question PRACTICAL exam for Calculus II with full worked solutions. Difficulty: hard.",
});
console.log("PRACTICAL EXAM:");
ex.object.questions.forEach((q, i) =>
  console.log(`  ${i + 1}. ${q.question}\n     solution: ${q.answer.slice(0, 90)}...\n`),
);
