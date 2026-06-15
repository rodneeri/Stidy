import { google } from "@ai-sdk/google";
import { generateText } from "ai";

const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
for (const id of models) {
  try {
    const { text } = await generateText({
      model: google(id),
      prompt: "Reply with exactly the two characters: OK",
    });
    console.log(`${id.padEnd(20)} → OK (${text.trim()})`);
  } catch (e) {
    console.log(`${id.padEnd(20)} → ERR: ${e.message.split("\n")[0]}`);
  }
}
