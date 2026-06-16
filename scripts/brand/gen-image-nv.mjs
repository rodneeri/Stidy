// Brand-image generator using NVIDIA-hosted FLUX.1-dev.
// Reads NVIDIA_API_KEY from .env.local. Usage:
//   node scripts/gen-image-nv.mjs <outPath> <width> <height> <<'PROMPT'
//   ...prompt...
//   PROMPT
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function loadKey() {
  const env = readFileSync(resolve(root, ".env.local"), "utf8");
  const m = env.match(/^NVIDIA_API_KEY="?([^"\r\n]+)"?/m);
  if (!m) throw new Error("NVIDIA_API_KEY not found in .env.local");
  return m[1];
}

const outPath = process.argv[2];
const width = Number(process.argv[3] || 1024);
const height = Number(process.argv[4] || 1024);
if (!outPath) throw new Error("usage: node scripts/gen-image-nv.mjs <outPath> <w> <h>  (prompt on stdin)");
const prompt = readFileSync(0, "utf8").trim();
if (!prompt) throw new Error("empty prompt on stdin");

const key = loadKey();
const res = await fetch("https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ prompt, width, height, steps: 40, cfg_scale: 3.5 }),
});

if (!res.ok) {
  console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 600)}`);
  process.exit(1);
}
const data = await res.json();
const b64 = data?.artifacts?.[0]?.base64;
if (!b64) {
  console.error("No image:", JSON.stringify(data).slice(0, 500));
  process.exit(2);
}
writeFileSync(resolve(root, outPath), Buffer.from(b64, "base64"));
console.log(`OK wrote ${outPath} (${width}x${height})`);
