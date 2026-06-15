---
type: note
created: 2026-06-14
updated: 2026-06-14
tags:
  - security
related:
  - "[[DevOps]]"
  - "[[Coding Standards]]"
  - "[[Tech Stack]]"
---

# Security

Security posture for [[STiDY]]. Erick is a student shipping a real app with real auth — treat his and
future users' data carefully.

## Authentication
- Supabase Auth via `@supabase/ssr`. `src/proxy.ts` refreshes the session on every request. Email
  confirmation is **ON**. Auth guard in `(app)/layout.tsx` (async `getUser()` → redirect `/login`).
- `/auth/confirm` (OTP) and `/auth/callback` (`?code=` exchange) handle email/OAuth flows.

## Row-Level Security
> [!important] Every table is owner-only
> RLS policy `auth.uid() = user_id` on all tables. Inserts set `user_id = auth.uid()`. **Any new table
> MUST enable RLS + an owner policy** (the `external_exams` and `goals` migration does this). The
> `profiles` table keys on `id == auth.uid()`.

## Secrets
- All secrets in `.env.local` only — never commit, never send to the client.
- **Service-role key is server-only.** Never expose it to the browser or a client component. Used only
  in `scripts/` and server code that needs to bypass RLS deliberately.
- Don't send secrets into AI prompts (Gemini/Groq).

## Storage
- `resources` bucket is **private**; access via **signed URLs** (1h expiry). Path namespaced by user:
  `${userId}/${uuid}_${name}`. `avatars` bucket planned (also user-namespaced).
- Upload guards: size limits (~10–15 MB) and MIME/type checks before processing.

## AI & privacy
> [!warning] PDF-grounded answers send file content to Gemini
> The planned PDF-grounded assistant ([[Features to add]]) uploads resource PDFs to Gemini for
> accurate answers. That means user document content leaves the app to a third party. Be explicit
> about this in UX, keep it opt-in-feeling, and don't send more than the query needs.

## Things to watch
- Don't leak one user's data via a missing RLS filter on a new query.
- Validate all AI/structured output with Zod before trusting it.
- Rate-limit handling already maps 429s to friendly messages — don't expose raw provider errors with
  internal detail to users.
