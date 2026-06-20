/**
 * NVIDIA NIM models the user can switch between from the prompt boxes.
 * Pure data — safe to import from both server routes and client components.
 * Add/remove ids here to change what appears in every picker.
 */
export interface AiModelOption {
  value: string;
  label: string;
  hint: string;
}

// Every id below was verified with a real 200 completion against this account's
// NVIDIA NIM endpoint (2026-06-15). The /v1/models list is NOT a reliable signal —
// several listed models 404 on completion — so test before adding new ones.
export const NVIDIA_MODELS: AiModelOption[] = [
  { value: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", hint: "Balanced all-rounder" },
  {
    value: "mistralai/mistral-large-3-675b-instruct-2512",
    label: "Mistral Large 3",
    hint: "Flagship 675B — hardest questions, EN/ES",
  },
  {
    value: "qwen/qwen3-next-80b-a3b-instruct",
    label: "Qwen3-Next 80B",
    hint: "Strong reasoning, maths & STEM",
  },
  { value: "meta/llama-3.1-70b-instruct", label: "Llama 3.1 70B", hint: "Reliable all-rounder" },
  { value: "meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B", hint: "Fastest — quick lookups" },
];

/** Google Gemini — most reliable at structured/JSON output. Sentinel value. */
export const GEMINI_MODEL_VALUE = "gemini";
export const GEMINI_OPTION: AiModelOption = {
  value: GEMINI_MODEL_VALUE,
  label: "Gemini 2.5 Flash",
  hint: "Google — most reliable, great at JSON",
};

/** Everything selectable in the in-app model pickers (Gemini + NVIDIA NIM). */
export const AI_MODELS: AiModelOption[] = [GEMINI_OPTION, ...NVIDIA_MODELS];

export const DEFAULT_AI_MODEL = NVIDIA_MODELS[0].value;

/** A valid model the user can pick (Gemini sentinel or a known NVIDIA id). */
export function isValidModel(v: unknown): v is string {
  return typeof v === "string" && AI_MODELS.some((m) => m.value === v);
}

/** True for a real NVIDIA NIM model id (i.e. not the Gemini sentinel). */
export function isNvidiaModel(v: unknown): v is string {
  return typeof v === "string" && NVIDIA_MODELS.some((m) => m.value === v);
}
