import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

const schema = z.object({ cards: z.array(z.object({ front: z.string(), back: z.string() })) });
const models = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "moonshotai/kimi-k2-instruct",
];

for (const model of models) {
  try {
    const { object } = await generateObject({
      model: groq(model),
      schema,
      prompt: "Create 1 flashcard about photosynthesis.",
    });
    console.log(`${model.padEnd(45)} → OK (${object.cards[0]?.front?.slice(0, 30)}…)`);
  } catch (e) {
    console.log(`${model.padEnd(45)} → ERR: ${e.message.split("\n")[0].slice(0, 70)}`);
  }
}
