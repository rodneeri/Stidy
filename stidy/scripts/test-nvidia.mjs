import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, generateObject } from "ai";
import { z } from "zod";

const key = process.env.NVIDIA_API_KEY;
if (!key) {
  console.log("No NVIDIA_API_KEY in stidy/.env.local yet. Add it (starts with 'nvapi-') and re-run.");
  process.exit(0);
}
const model = process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct";
const nim = createOpenAICompatible({
  name: "nvidia",
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: key,
});

console.log(`Testing NVIDIA NIM model: ${model}\n`);

try {
  const { text } = await generateText({
    model: nim(model),
    prompt: "In one sentence, explain integration by parts.",
  });
  console.log("TEXT (chat) → OK:\n  " + text.slice(0, 180).replace(/\n/g, " ") + "…\n");
} catch (e) {
  console.log("TEXT (chat) → ERROR: " + e.message.split("\n")[0] + "\n");
}

try {
  const { object } = await generateObject({
    model: nim(model),
    schema: z.object({ cards: z.array(z.object({ front: z.string(), back: z.string() })) }),
    prompt: "Create 2 flashcards about photosynthesis.",
  });
  console.log(`OBJECT (structured) → OK: ${object.cards.length} cards — Study Lab can use NVIDIA too.`);
} catch (e) {
  console.log(
    "OBJECT (structured) → not supported on this model (chat still works; Study Lab keeps Gemini): " +
      e.message.split("\n")[0],
  );
}
