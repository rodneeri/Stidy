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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Messages = any;
function hasFilePart(messages: Messages | undefined): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => Array.isArray(m?.content) && m.content.some((p: any) => p?.type === "file"),
  );
}

/** Try each model in order; wait+retry the first on rate-limit, then fall through. */
async function runChain<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  models: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (m: any) => Promise<T>,
  maxWaitSec: number,
): Promise<T> {
  let lastErr: unknown = new Error("No AI provider configured");
  for (let i = 0; i < models.length; i++) {
    try {
      return await run(models[i]);
    } catch (e) {
      lastErr = e;
      if (i === 0 && isRateLimit(e)) {
        const d = retryDelaySec(e);
        if (d != null && d <= maxWaitSec) {
          await sleep((d + 1) * 1000);
          try {
            return await run(models[i]);
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
  const run = async (model: any): Promise<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { object } = await generateObject({ model, schema, ...payload } as any);
    return object as T;
  };
  return runChain(models, run, maxWaitSec);
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
  const call = async (model: any): Promise<string> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await generateText({ model, system, ...payload } as any)).text;

  let lastErr: unknown = new Error("No AI provider configured");
  for (let i = 0; i < chain.length; i++) {
    const { label, model } = chain[i];
    try {
      return { text: await call(model), model: label };
    } catch (e) {
      lastErr = e;
      if (i === 0 && isRateLimit(e)) {
        const d = retryDelaySec(e);
        if (d != null && d <= maxWaitSec) {
          await sleep((d + 1) * 1000);
          try {
            return { text: await call(model), model: label };
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
