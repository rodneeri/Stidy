// One-off brand-image generator using Gemini's image model (nano-banana).
// Reads GOOGLE_GENERATIVE_AI_API_KEY from .env.local. Usage:
//   node scripts/gen-image.mjs <outPath> <<'PROMPT'
//   ...prompt text...
//   PROMPT
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function loadKey() {
  const env = readFileSync(resolve(root, ".env.local"), "utf8");
  const m = env.match(/^GOOGLE_GENERATIVE_AI_API_KEY="?([^"\r\n]+)"?/m);
  if (!m) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not found in .env.local");
  return m[1];
}

const outPath = process.argv[2];
if (!outPath) throw new Error("usage: node scripts/gen-image.mjs <outPath>  (prompt on stdin)");
const prompt = readFileSync(0, "utf8").trim();
if (!prompt) throw new Error("empty prompt on stdin");

const MODEL = process.env.GEN_MODEL || "gemini-2.5-flash-image";
const key = loadKey();
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
});

if (!res.ok) {
  const t = await res.text();
  console.error(`HTTP ${res.status}: ${t.slice(0, 800)}`);
  process.exit(1);
}

const data = await res.json();
const parts = data?.candidates?.[0]?.content?.parts ?? [];
const img = parts.find((p) => p.inlineData?.data);
if (!img) {
  console.error("No image in response:", JSON.stringify(data).slice(0, 800));
  process.exit(2);
}
writeFileSync(resolve(root, outPath), Buffer.from(img.inlineData.data, "base64"));
console.log(`OK wrote ${outPath} (${img.inlineData.mimeType})`);
