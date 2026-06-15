---
type: reference
created: 2026-06-14
updated: 2026-06-14
tags:
  - standards
  - stack
related:
  - "[[Coding Standards]]"
  - "[[STiDY]]"
  - "[[DevOps]]"
---

# Tech Stack

The stack for [[STiDY]]. Erick wants **free** tooling (no paid Claude API key) and a Vercel-free-tier
deploy.

## Framework & language
- **Next.js 16.2.9** — App Router, Server Actions, Turbopack. ⚠️ `proxy.ts` (not middleware), async
  `cookies()`/`searchParams`. See [[Coding Standards]].
- **React 19.2**
- **TypeScript** strict + **Zod** for validation/structured output

## UI
- **Tailwind v4** (CSS-first, no config file — tokens in `globals.css`)
- **Framer Motion 12** (`framer-motion`)
- **shadcn / Radix** primitives, **lucide-react** icons
- `clsx` + `tailwind-merge` → `cn()`; `class-variance-authority`
- `tw-animate-css`, `@tailwindcss/typography`, KaTeX (math), Recharts / Nivo (charts), `date-fns`

## Backend — Supabase
- Postgres + Realtime + Edge + Storage, wired via **`@supabase/ssr`** (browser + server clients + `proxy.ts`)
- RLS owner-only on every table. Project ref `obqwiewwkylyrhsrmmob`. Storage buckets: `resources`
  (private, signed URLs), `avatars` (planned).
- Schema in `supabase/schema.sql`; idempotent migrations in `supabase/migrations/`.

## AI (provider-agnostic `lib/ai`)
> [!info] Default provider is Gemini, NOT Claude
> Erick has no Claude API key and wants free. The abstraction means swapping providers = one adapter.
- **Vercel AI SDK v6** (`ai`) + **`@ai-sdk/google`** (Gemini — default, free tier)
- **`@ai-sdk/groq`** fallback. ⚠️ Groq json_schema model = **`openai/gpt-oss-20b`**
  (`llama-3.3-70b-versatile` does NOT support json_schema).
- `@ai-sdk/anthropic` installed as an alternate. **LangChain** installed.
- Models: `gemini-2.5-flash` (heavy: syllabus/analyze/studygen — has PDF/image vision),
  `gemini-2.5-flash-lite` (light/high-volume: resource classify). Env overrides `GEMINI_MODEL`,
  `GEMINI_MODEL_LIGHT`, `GROQ_MODEL`.
- `generateObjectAI` / `generateTextAI` in `lib/ai/models.ts`: rate-limit retry → Groq fallback for
  text-only; `aiErrorResponse` maps 429s to a friendly message. Vision calls can't fall back to Groq.

## State
- **Zustand** (client stores: theme, grade-scale, subject icons) + **TanStack Query** (server cache)

## Env (`stidy/.env.local`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`. See [[Security]] and [[DevOps]].
