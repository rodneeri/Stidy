import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, generateText } from "ai";
import type { z } from "zod";

/**
 * Central AI helper. Picks the best provider per task and is resilient:
 *  - NVIDIA NIM (best open models for education) is primary for chat/text when
 *    NVIDIA_API_KEY is set; Gemini stays primary for structured + vision tasks.
 *  - On rate-limit it waits the suggested delay + retries, then falls through a
 *    provider chain (NVIDIA → Gemini → Groq) so a busy free tier never hard-fails.
 * All models overridable via env.
 */
const HEAVY = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const LIGHT = process.env.GEMINI_MODEL_LIGHT ?? "gemini-2.5-flash-lite";
const GROQ = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";
const NVIDIA_MODEL = process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct";

// NVIDIA NIM — OpenAI-compatible. Only created when a key is present.
const nim = process.env.NVIDIA_API_KEY
  ? createOpenAICompatible({
      name: "nvidia",
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: process.env.NVIDIA_API_KEY,
    })
  : null;

export const heavyModel = () => google(HEAVY);
export const lightModel = () => google(LIGHT);
export const hasNvidia = !!nim;

function isRateLimit(err: unknown) {
  const m = err instanceof Error ? err.message : String(err);
  return /quota|rate.?limit|429|exceeded|resource_exhausted/i.test(m);
}
function retryDelaySec(err: unknown): number | null {
  const m = err instanceof Error ? err.message : String(err);
  const x = m.match(/retry in ([\d.]+)s/i);
  return x ? Math.ceil(Number(x[1])) : null;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Hard ceiling per provider attempt. With a ~60s serverless limit and up to
// three providers in the chain, no single slow/hung provider (NVIDIA cold
// starts, a stalled stream) may consume the whole budget — abort and fall
// through instead of letting the function 504. Also cap the SDK's own retry
// backoff (we run our own provider fallback chain).
const PER_ATTEMPT_MS = 18_000;
const SDK_MAX_RETRIES = 1;
// Whole-request budget, kept under the 60s serverless limit with headroom so we
// always return a clean error instead of a 504. Every attempt's abort timeout is
// clamped to the time remaining, so the chain (sleeps + all providers) can never
// overrun this.
const TOTAL_BUDGET_MS = 50_000;
const MIN_ATTEMPT_MS = 4_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Messages = any;
function hasFilePart(messages: Messages | undefined): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => Array.isArray(m?.content) && m.content.some((p: any) => p?.type === "file"),
  );
}

/**
 * Try each model in order; wait+retry the first on rate-limit, then fall
 * through. Deadline-aware: each attempt's abort timeout is clamped to the time
 * left in TOTAL_BUDGET_MS, so the whole chain (sleeps included) never overruns
 * the serverless limit and we return a clean error instead of a 504.
 */
async function runChain<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  models: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (m: any, timeoutMs: number) => Promise<T>,
  maxWaitSec: number,
): Promise<T> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const left = () => deadline - Date.now();
  let lastErr: unknown = new Error("No AI provider configured");
  for (let i = 0; i < models.length; i++) {
    if (left() < MIN_ATTEMPT_MS) break;
    try {
      return await run(models[i], Math.min(PER_ATTEMPT_MS, left()));
    } catch (e) {
      lastErr = e;
      if (i === 0 && isRateLimit(e)) {
        const d = retryDelaySec(e);
        if (d != null && d <= maxWaitSec && (d + 1) * 1000 < left() - MIN_ATTEMPT_MS) {
          await sleep((d + 1) * 1000);
          if (left() < MIN_ATTEMPT_MS) break;
          try {
            return await run(models[i], Math.min(PER_ATTEMPT_MS, left()));
          } catch (e2) {
            lastErr = e2;
          }
        }
      }
    }
  }
  throw lastErr;
}

interface ObjArgs<T> {
  schema: z.ZodType<T>;
  prompt?: string;
  messages?: Messages;
  tier?: "heavy" | "light";
  groqFallback?: boolean;
  maxWaitSec?: number;
  /** Override the NVIDIA model id (from the in-app picker). Falls back to the env default. */
  nvidiaModel?: string;
}

export async function generateObjectAI<T>(args: ObjArgs<T>): Promise<T> {
  const { schema, prompt, messages, tier = "heavy", groqFallback = false, maxWaitSec = 25, nvidiaModel } = args;
  const payload = messages ? { messages } : { prompt };
  const textOnly = !hasFilePart(messages);
  // Gemini first (vision-capable + proven structured); NVIDIA/Groq for text-only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const models: any[] = [tier === "light" ? google(LIGHT) : google(HEAVY)];
  if (textOnly && nim) models.push(nim(nvidiaModel ?? NVIDIA_MODEL));
  if (textOnly && groqFallback) models.push(groq(GROQ));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = async (model: any, timeoutMs: number): Promise<T> => {
    const { object } = await generateObject({
      model,
      schema,
      ...payload,
      maxRetries: SDK_MAX_RETRIES,
      abortSignal: AbortSignal.timeout(timeoutMs),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return object as T;
  };
  return runChain(models, run, maxWaitSec);
}

/** Pull the first balanced JSON value out of a model's text reply. */
function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.search(/[{[]/);
  if (start === -1) return t;
  const open = t[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < t.length; i++) {
    if (t[i] === open) depth++;
    else if (t[i] === close && --depth === 0) return t.slice(start, i + 1);
  }
  return t.slice(start);
}

/**
 * Structured generation that works on ANY provider — Gemini, NVIDIA NIM, Groq —
 * by asking for plain-text JSON and parsing/validating it ourselves, instead of
 * generateObject's tool/json-schema mode (which NVIDIA NIM and Groq reject —
 * the "Failed to generate JSON" 500s). Honours the user's picked model: that
 * provider goes FIRST, the rest are fallback. Deadline-bound like runChain.
 */
export async function generateJsonAI<T>(args: {
  schema: z.ZodType<T>;
  prompt: string;
  /** Plain-language description of the exact JSON shape to return. */
  jsonShape: string;
  /** User-picked model id: the Gemini sentinel, an NVIDIA id, or undefined. */
  preferred?: string;
  maxWaitSec?: number;
}): Promise<T> {
  const { schema, prompt, jsonShape, preferred, maxWaitSec = 10 } = args;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order: { label: string; model: any }[] = [];
  const gemini = { label: `Gemini · ${HEAVY}`, model: google(HEAVY) };
  const pushNvidia = (id: string) => nim && order.push({ label: `NVIDIA · ${id}`, model: nim(id) });
  if (preferred && preferred !== "gemini" && nim) {
    pushNvidia(preferred);
    order.push(gemini);
  } else {
    order.push(gemini);
    pushNvidia(NVIDIA_MODEL);
  }
  order.push({ label: `Groq · ${GROQ}`, model: groq(GROQ) });

  const system =
    "You output ONLY a single JSON value — no markdown fences, no commentary before or after.";
  const full = `${prompt}\n\nReturn ONLY valid JSON matching this exact shape:\n${jsonShape}`;

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const left = () => deadline - Date.now();
  let lastErr: unknown = new Error("No AI provider configured");
  for (let i = 0; i < order.length; i++) {
    if (left() < MIN_ATTEMPT_MS) break;
    try {
      const { text } = await generateText({
        model: order[i].model,
        system,
        prompt: full,
        maxRetries: SDK_MAX_RETRIES,
        abortSignal: AbortSignal.timeout(Math.min(PER_ATTEMPT_MS, left())),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const parsed = schema.safeParse(JSON.parse(extractJson(text)));
      if (parsed.success) return parsed.data;
      lastErr = new Error("The model's JSON didn't match the expected shape.");
    } catch (e) {
      lastErr = e;
      if (i === 0 && isRateLimit(e)) {
        const d = retryDelaySec(e);
        if (d != null && d <= maxWaitSec && (d + 1) * 1000 < left() - MIN_ATTEMPT_MS) {
          await sleep((d + 1) * 1000);
        }
      }
    }
  }
  throw lastErr;
}

export async function generateTextAI(args: {
  system?: string;
  messages?: Messages;
  prompt?: string;
  tier?: "heavy" | "light";
  groqFallback?: boolean;
  maxWaitSec?: number;
  /** Override the NVIDIA model id (from the in-app picker). Falls back to the env default. */
  nvidiaModel?: string;
}): Promise<{ text: string; model: string }> {
  const { system, messages, prompt, tier = "heavy", groqFallback = true, maxWaitSec = 25, nvidiaModel } = args;
  const payload = messages ? { messages } : { prompt };
  const textOnly = !hasFilePart(messages);
  // NVIDIA NIM first for chat (best educational models), then Gemini, then Groq.
  // Each entry is labelled so the caller can show which model actually answered.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: { label: string; model: any }[] = [];
  if (nim) chain.push({ label: `NVIDIA · ${nvidiaModel ?? NVIDIA_MODEL}`, model: nim(nvidiaModel ?? NVIDIA_MODEL) });
  chain.push({
    label: `Gemini · ${tier === "light" ? LIGHT : HEAVY}`,
    model: tier === "light" ? google(LIGHT) : google(HEAVY),
  });
  if (groqFallback && textOnly) chain.push({ label: `Groq · ${GROQ}`, model: groq(GROQ) });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = async (model: any, timeoutMs: number): Promise<string> =>
    (
      await generateText({
        model,
        system,
        ...payload,
        maxRetries: SDK_MAX_RETRIES,
        abortSignal: AbortSignal.timeout(timeoutMs),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).text;

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const left = () => deadline - Date.now();
  let lastErr: unknown = new Error("No AI provider configured");
  for (let i = 0; i < chain.length; i++) {
    if (left() < MIN_ATTEMPT_MS) break;
    const { label, model } = chain[i];
    try {
      return { text: await call(model, Math.min(PER_ATTEMPT_MS, left())), model: label };
    } catch (e) {
      lastErr = e;
      if (i === 0 && isRateLimit(e)) {
        const d = retryDelaySec(e);
        if (d != null && d <= maxWaitSec && (d + 1) * 1000 < left() - MIN_ATTEMPT_MS) {
          await sleep((d + 1) * 1000);
          if (left() < MIN_ATTEMPT_MS) break;
          try {
            return { text: await call(model, Math.min(PER_ATTEMPT_MS, left())), model: label };
          } catch (e2) {
            lastErr = e2;
          }
        }
      }
    }
  }
  throw lastErr;
}

/** Turn a provider error into a clean { status, body } — friendly on rate limits. */
export function aiErrorResponse(err: unknown): { status: number; body: { error: string } } {
  const m = err instanceof Error ? err.message : "AI request failed";
  // Per-attempt abort (slow/hung provider) — surface as a retryable busy state,
  // not a raw "aborted" message, and never a 504.
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError" || /abort|timed? ?out/i.test(m))) {
    return {
      status: 503,
      body: { error: "The AI took too long this time — try again, lower the count, or pick a different model in Settings." },
    };
  }
  if (isRateLimit(err)) {
    const retry = retryDelaySec(err);
    return {
      status: 429,
      body: {
        error: `AI is busy on the free tier${
          retry ? ` — try again in ~${retry}s` : " — wait a moment and retry"
        }.`,
      },
    };
  }
  return { status: 500, body: { error: m } };
}
