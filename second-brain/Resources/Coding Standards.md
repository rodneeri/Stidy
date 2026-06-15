---
type: reference
created: 2026-06-14
updated: 2026-06-14
tags:
  - standards
  - code
related:
  - "[[Tech Stack]]"
  - "[[Design Standards]]"
  - "[[DevOps]]"
  - "[[STiDY]]"
---

# Coding Standards

Conventions for Erick's code (primarily [[STiDY]]). The meta-rule: **write code that reads like the
code already there** — match naming, comment density, and idioms of the surrounding file.

## Language & types
- **TypeScript strict + Zod.** Validate external/AI input with Zod schemas; derive types from them.
- Hand-written domain types mirror the DB in `src/types/db.ts`. Keep them in sync with `supabase/schema.sql`.
- Prefer small, focused, well-bounded modules. When a file grows large (GradeEngine is ~880 lines),
  extract panels/subcomponents (e.g. `ExternalExamsPanel`, `SubjectsGrid`).

## Next.js 16 — this is NOT the Next you remember
> [!danger] Read the docs first
> `stidy/AGENTS.md` mandates reading `node_modules/next/dist/docs/` before writing Next code. Breaking
> changes from training data:
> - **Middleware is renamed `proxy`.** File is `src/proxy.ts` exporting `proxy()`, *not* `middleware.ts`.
> - `cookies()` is **async**. `searchParams` is **async** (page props are Promises).
> - App Router swaps content instantly → page transitions need the FrozenRouter trick ([[STiDY]]).

## React patterns
- **Client vs server boundary matters for state.** `localStorage`-backed stores (theme, subject icons,
  grade scale) are **client-only** — server components (the dashboard) can't read them. To show
  something server-side, it must live in the DB (e.g. the planned `subjects.icon` column).
- **Portal every `fixed` overlay.** A transformed/`will-change:transform` ancestor (like the page
  transition) makes `position:fixed` resolve against the content column, not the viewport. Use
  `components/ui/Portal.tsx`. (This caused the misaligned-scrim bug — see [[Learning Log]].)
- Reusable UI primitives live in `components/ui/`: `Modal`, `Dropdown`, `Toggle`, `ConfirmDelete`,
  `NeuSlider`, `DateTimePicker`, `EmojiPicker`, `Portal`, `Skeleton`, `EmptyState`, `SubjectIcon`.
  **Reuse these** — don't reinvent.
- Shared motion lives in `lib/motion.ts` (see [[Design Standards]]). Don't scatter spring configs.

## Database workflow
> [!important] Erick runs all SQL himself
> No PAT / DB password for programmatic DDL, and he **rejected the Supabase MCP**. Wire Supabase the
> standard env-based way (`@supabase/ssr`). When a feature needs schema changes:
> 1. Write an **idempotent** migration to `supabase/migrations/` (`add column if not exists`,
>    `create table if not exists`, `drop policy if exists` before create).
> 2. Give Erick a **copy-paste SQL block** to run in the Supabase SQL Editor.
> 3. Make the feature **degrade gracefully** until he runs it — feature-detect missing columns/tables
>    and retry stripping the new fields, with a friendly "run the migration" hint.

- All tables are **RLS owner-only** (`auth.uid() = user_id`); every new table must enable RLS + policy.
  See [[Security]].
- Verify DB state with `stidy/scripts/*.mjs` using `node --env-file=.env.local` + the service-role key.
  **Avoid live AI test scripts** — they burn Gemini's free-tier quota.

## Verify before claiming
- Run `npx next build` after each chunk; it type-checks. Report ✅ with the route count.
- Lint changed files with `npx eslint <paths>`.
- **Accepted, codebase-wide, non-blocking lint warnings:** `react-hooks/set-state-in-effect` and the
  FrozenRouter `refs-during-render`. They exist throughout (GradeEngine, DateTimePicker, PageTransition,
  Portal) and don't fail the build. Don't churn trying to "fix" them unless asked.
- Restart the dev server after big changes and confirm routes serve (`/login` 200, `/` 307).

## Graceful, additive, low-risk
- Prefer additive changes that keep the build green at every step.
- Keep the user's original data intact (e.g. resources keep their original filename as title; AI only
  sets metadata).
