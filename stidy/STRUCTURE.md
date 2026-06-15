# STiDY — Proposed Folder Structure

A **feature-sliced** Next.js 15 (App Router) layout. Routes stay thin; domain
logic lives in `src/features/*` so the Grade Engine, SRS, and AI pipelines can
grow without route bloat. `src/` keeps app code separate from config.

```
stidy/
├─ src/
│  ├─ app/                              # App Router (routing only — thin)
│  │  ├─ (auth)/                        # public route group
│  │  │  ├─ login/page.tsx
│  │  │  └─ signup/page.tsx
│  │  ├─ (app)/                         # protected shell: sidebar+topbar+mesh bg
│  │  │  ├─ layout.tsx                  # auth guard + AppShell
│  │  │  ├─ dashboard/page.tsx
│  │  │  ├─ subjects/[id]/page.tsx
│  │  │  ├─ grades/page.tsx             # Grade Intelligence Engine UI
│  │  │  ├─ resources/page.tsx          # Resource Vault + in-app viewer
│  │  │  ├─ timetable/page.tsx
│  │  │  ├─ flashcards/page.tsx         # SRS review
│  │  │  ├─ graph/page.tsx              # Knowledge Graph
│  │  │  ├─ focus/page.tsx              # Pomodoro + ambience
│  │  │  └─ settings/page.tsx           # Theme engine, accents
│  │  ├─ api/                           # route handlers (AI streaming, webhooks)
│  │  │  ├─ syllabus/parse/route.ts
│  │  │  └─ ai/[...]/route.ts
│  │  ├─ globals.css                    # ← theme engine (done)
│  │  ├─ layout.tsx                     # RootProviders (theme, query, toaster)
│  │  └─ not-found.tsx
│  │
│  ├─ components/
│  │  ├─ ui/                            # shadcn primitives (customized)
│  │  ├─ motion/                        # framer-motion wrappers
│  │  │  ├─ MagneticButton.tsx
│  │  │  ├─ PageTransition.tsx
│  │  │  └─ FadeIn.tsx
│  │  ├─ layout/                        # Sidebar, Topbar, AppShell, MeshBackground
│  │  └─ shared/                        # GlassCard, Skeletons, EmptyState
│  │
│  ├─ features/                         # domain logic (the real app)
│  │  ├─ grades/
│  │  │  ├─ components/                 # GradeDial, WhatIfSliders, TargetSolver
│  │  │  ├─ lib/                        # weighted-average, target-solver (pure fns)
│  │  │  ├─ hooks/                      # useSubjectGrade (TanStack Query)
│  │  │  ├─ actions.ts                  # server actions
│  │  │  └─ schemas.ts                  # zod
│  │  ├─ syllabus/                      # upload → OCR → LLM extract → review
│  │  ├─ resources/                     # vault, drag-drop, viewer, annotations
│  │  ├─ flashcards/                    # SM-2 SRS engine + generator
│  │  ├─ timetable/                     # weekly grid + conflict detection
│  │  ├─ knowledge-graph/               # node-link (force layout)
│  │  └─ focus/                         # timer store, burnout monitor
│  │
│  ├─ lib/
│  │  ├─ supabase/                      # client.ts, server.ts, middleware.ts
│  │  ├─ ai/                            # Vercel AI SDK + LangChain pipelines
│  │  ├─ utils.ts                       # cn() = clsx + tailwind-merge
│  │  └─ constants.ts
│  │
│  ├─ stores/                           # Zustand: theme, ambience, timer
│  ├─ config/                           # themes registry, site metadata, nav
│  ├─ hooks/                            # cross-feature hooks
│  └─ types/                            # global TS + generated DB types
│
├─ supabase/
│  ├─ schema.sql                        # ← full schema + RLS (done)
│  ├─ migrations/
│  └─ functions/                        # Edge Functions (syllabus-parse, …)
│
├─ public/
├─ tailwind.config.ts                   # ← thin v4 config (done)
├─ components.json                      # shadcn config
├─ next.config.ts · tsconfig.json · .eslintrc · .prettierrc · .env.local
└─ package.json
```

## Rationale (impeccable / scalability)

- **Route group `(app)`** owns the authenticated shell (sidebar + topbar +
  fixed `MeshBackground`) so every protected page inherits the ambient layout
  and the auth guard in one `layout.tsx`.
- **`features/*` over a flat `components/`** — each domain ships its own
  `components / lib / hooks / actions / schemas`. Pure functions
  (`grades/lib/*`) are unit-testable in isolation (TDD-ready) and mirror the SQL
  `stidy_subject_grade` engine so the "What-If" and "Target Solver" can run
  optimistically on the client and reconcile with the DB.
- **`stores/` (Zustand)** holds only cross-page client state that must persist
  across navigation: active theme, the **Ambience Player** (audio survives route
  changes), and the **Deep Work Timer**.
- **`lib/supabase` split** into `client` / `server` / `middleware` matches the
  Next 15 SSR auth model (cookies on the server, realtime on the client).
- **`config/themes`** is the single registry the Settings page reads to render
  the theme switcher; adding a 5th preset = one entry + one CSS block.
```
