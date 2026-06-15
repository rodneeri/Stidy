---
type: project
created: 2026-06-14
updated: 2026-06-14
status: active
tags:
  - project
  - stidy
related:
  - "[[Tech Stack]]"
  - "[[Design Standards]]"
  - "[[Coding Standards]]"
  - "[[Features to add]]"
  - "[[Learning Log]]"
---

# STiDY

**STiDY** is a **Personal Academic Operating System** — a command center that replaces planners, grade
calculators, LMS dashboards, and flashcard apps. Named by Erick (2026-06-13; the spec originally called
it "Nexus Study"). Vibe: **Linear × Notion × Cyberpunk** — "expensive, fluid, immersive."

> [!info] Identity
> Built by Erick (UCM Madrid). App account `erkgraff@gmail.com`. Stack and conventions in [[Tech Stack]],
> [[Design Standards]], [[Coding Standards]]. Deep visual/design history also lives in the auto-memory.

## Feature modules
- **A — Grade Intelligence Engine:** syllabus parser (Gemini vision) → dynamic weighted calculator,
  What-If sliders, category/item grades, AI grade analyzer, grading-scale switch (%, /10, letter, GPA).
- **B — Org / Knowledge:** Subjects & **Careers** (degree/bachillerato/oposición), Resource Vault
  (upload → AI auto-classify + subject-match, in-app viewer, drag-to-reassign, fly animation),
  Timetable (grouped to-do, exam-conflict defusal + extension email). Knowledge graph = future.
- **C — AI Assistant / Study Lab:** AI flashcards + written/practical exams (grounded in subject
  resources), SM-2 SRS review, syllabus-aware chat ("Ask STiDY"). PDF-grounded answers = next.
- **D — Focus / Wellness:** Pomodoro/Deep-work timer + stopwatch, Web-Audio ambience, burnout nudge,
  iPhone-style time wheel.

## Status (2026-06-14)
Real Next.js app at `stidy/`. Core + polish **done & building green**: themes (5, neumorphic),
typography/logo, Grade Engine (+AI parser/analyzer), Subjects + **Careers grouping**, customizable
Dashboard, Resources (+viewer/folders/fly), Timetable (redesigned + filter), Study Lab (AI flashcards
+ exams + SRS), full Help manual, Focus, AI resilience (Gemini + Groq fallback), and the 2026-06-14
overlay/portal + motion + loading + emoji polish batch.

## In flight
See [[Features to add]] / [[Short Term Ideas]]: **Mock EVAU**, **PDF-grounded AI**, **Nota de corte /
Goals** (multi-country, oposiciones), **Profile + EN/ES i18n**, dashboard emoji from DB.

> [!warning] Pending action
> Erick must run `supabase/migrations/2026-06-14_careers_profiles_goals.sql` for career kinds, external
> exams, DB emoji, and the goals table.

## Data model
9 base tables + `careers`, now `external_exams` + `goals`. All RLS owner-only. The Grade Engine's
weighted average is mirrored client-side in `features/grades/lib/calc.ts`. Full schema in
`supabase/schema.sql`. (The detailed `STiDY/` folder in this vault holds deeper sub-notes.)
