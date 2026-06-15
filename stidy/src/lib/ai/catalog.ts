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

export const NVIDIA_MODELS: AiModelOption[] = [
  { value: "meta/llama-3.3-70b-instruct", label: "Llama 3.3 70B", hint: "Balanced all-rounder" },
  {
    value: "nvidia/llama-3.1-nemotron-70b-instruct",
    label: "Nemotron 70B",
    hint: "Strong reasoning & instructions",
  },
  { value: "qwen/qwen2.5-72b-instruct", label: "Qwen 2.5 72B", hint: "Great at maths & STEM" },
];

export const DEFAULT_AI_MODEL = NVIDIA_MODELS[0].value;

export function isValidModel(v: unknown): v is string {
  return typeof v === "string" && NVIDIA_MODELS.some((m) => m.value === v);
}
