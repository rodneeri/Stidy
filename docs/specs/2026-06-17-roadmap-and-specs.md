# STiDY — Roadmap & Design Specs (2026-06-17)

Written overnight in response to Erick's "STiDY Issues and Observations" note
(2026-06-16). Erick asked me to keep working autonomously while he slept, fix
the blockers + quick wins, and **write specs (for his review) for the big
features** rather than implement them blind.

This doc has three parts:
1. **What shipped tonight** (already on `main`).
2. **Needs Erick's action** (can't be done from code alone).
3. **Design specs** for the remaining big features — review these, then I build.

---

## 1. Shipped tonight (on `main`, CI green, deployed)

| Commit | What |
|--------|------|
| `fix(ci)` | Regenerated the stale `package-lock.json` (it had 8 entries, missing `next`) — that was why **CI failed on every run** (`npm ci` couldn't install). Added a `test` script (`tsc --noEmit`) so the `npm test` step passes; bumped the Node matrix to 20/22/24 and actions to v5 (clears the Node-20 deprecation warnings). |
| `feat(errors)` | **Global Error Center.** Any error now opens a popup on top of everything with the title, the *true* system message/log, and a "what to do" hint + copy-report button. Installs `window.onerror`/`unhandledrejection` handlers so even uncaught errors surface. Fixed the **exam-generation crash** (`Unexpected token 'A'…`): the client parsed JSON before checking the response was OK, so a timeout page threw. New `apiFetch` helper never does that again; the API route always returns JSON now. |
| `fix(ui)` | **Theme reset fixed** — `ThemeProvider` now treats localStorage as authoritative and re-applies the chosen theme on mount *and* every route change, so clicking the logo / a reload no longer snaps back to default. Removed the redundant ⌘K command button (search bar covers it). Dropped the full-screen backdrop-blur behind the flashcard 3D flip to reduce GPU pressure (suspected cause of the `STATUS_ACCESS_VIOLATION` crash — **needs confirmation on your machine**). Subjects hide the code/professor line when empty (no more "No details"). |
| `feat(account)` | Admin foundation: `isAdminEmail()` (you, `erkgraff@gmail.com`, are built in). Rebuilt the profile dropdown as a real click-to-open menu with an **Admin** badge, Settings, and Sign out. |
| `feat(ui)` | **Calm color-breathing** on every section-header title (Command center, Grade engine, Focus, Resources, Study Lab, Grades, Timetable, Settings, Cowork) — a slow 9s drift toward the accent. Reduced-motion users opt out. (Timer ring + sliders already breathed.) |
| `fix(cowork)` | Chat is now **self-diagnosing**: send errors and realtime failures surface in the Error Center (instead of silently doing nothing), and your own messages render optimistically. See §2 for the likely root cause. |

---

## 2. Needs Erick's action (can't fix from code alone)

### 2a. Coworking chat — verify the Supabase migration is applied
The chat code is correct, and the migration (`supabase/migrations/2026-06-16_coworking.sql`)
has the right member-scoped RLS **and** adds all 3 tables to the realtime
publication. Your symptom ("only 1 user can type, messages don't appear") is
exactly what happens when **the migration isn't fully applied** (so the second
user never becomes a `cowork_member`, and/or realtime isn't broadcasting).

**Do this:** open Supabase → SQL Editor → paste the *contents* of
`supabase/migrations/2026-06-16_coworking.sql` and run it. (Your memory notes a
prior attempt pasted the file *path* instead of the contents.) Then in
Supabase → Database → Replication, confirm `cowork_messages`, `cowork_members`,
`cowork_rooms` are in the `supabase_realtime` publication. Reload the app and
test with two accounts — the Error Center will now tell you precisely what
fails if anything still does.

### 2b. GPU crash on flashcard shuffle
I mitigated the most likely cause (stacked backdrop-blur + 3D transforms). If it
still crashes, open the deck, hit shuffle, and tell me the exact step + your
GPU (chrome://gpu). It may need the 3D flip replaced with a 2D cross-fade.

---

## 3. Design specs for the big features (review, then I build)

> Each is sized to its own spec → plan → build cycle. Where there's a real
> decision, I've put **[DECIDE]**. Defaults are my recommendation.

### 3.1 Per-subject hub + scalable subject/career management
**Goal:** clicking a subject in *Subjects* opens a focused hub (Google-Classroom
style) scoped to that subject — its Resources, Study Lab, Focus, Timetable, and
Grades — while the rest of the app stays global. Must stay clean with many
subjects/careers.

**Design:**
- New route `/(app)/subjects/[id]` rendering a **subject hub**: header (icon,
  name, code/professor if present, current grade), then a tab bar:
  `Overview · Resources · Study Lab · Focus · Timetable · Grades`. Each tab
  reuses the existing feature component, **pre-filtered to `subject_id`**.
- The existing feature pages (global) gain a `subjectId?` prop; when present they
  scope their queries and hide the subject picker. No logic duplication.
- *Subjects* list itself: switch from name-flooding to a **dense, filterable
  grid** — search box + filters (career, year, term, archived), grouped by
  career → year. Cards show icon, name, grade chip, resource/exam counts.
- Careers: same treatment; collapsible career sections (already partly built).
- **[DECIDE]** Subject hub as a full page (recommended — shareable URL, back
  button) vs. an in-place panel overlay.

**Open Q:** should Focus/Timetable inside a subject hub *write* a `subject_id`
on new entries automatically? (Recommended: yes.)

### 3.2 Flashcards → grid of named sets with stats
**Goal:** generated flashcards group into a grid of **named sets** (editable
title, no questions shown), each showing: # cards, difficulty, times completed,
average score.

**Data model decision [DECIDE]:**
- **Option A (recommended): new `flashcard_sets` table** (`id, user_id,
  subject_id, name, difficulty, created_at`) + `flashcards.set_id` FK. Clean,
  scales, enables per-set stats. Needs a migration (you run it).
- Option B: client-side grouping by a `set_id` stored in `flashcards.source`
  JSON — no migration, but fragile.

**Stats:** add `flashcard_set_runs` (`set_id, user_id, score, total,
completed_at`) or reuse the existing `flashcard-stats` localStorage layer keyed
by set. Average score + times completed come from there. Difficulty stored on
the set at generation time.

**UI:** `StudyLab` shows a responsive grid of set cards: title (inline-editable
pencil), difficulty chip, "N cards", "Completed ×K · avg 82%". Click → the
existing study/stack view, scoped to that set.

### 3.3 Timetable redesign
**Goal:** compact rows (not full-width blocks), filterable by subject, career,
type (exam/assignment/class…).

**Design:** switch entry rendering to a **dense list**: each row = colored
type-dot · title · subject chip · due date/time · actions, ~48px tall. Sticky
filter bar (segmented control for type + dropdowns for subject/career + search).
Group by day/week with collapsible headers. Virtualize if >100 rows.

### 3.4 Resources redesign
**Goal:** less "ugly and simple"; filterable, nicer cards.
**Design:** filter bar (subject, kind, search) + a card/list toggle. Cards show
kind icon, title, subject chip, summary snippet, date. Add a **"Cowork files"**
category here (ties into §3.6 file system). Empty states with a real CTA.

### 3.5 Landing page redesign
**Goal:** keep the *current visual identity*, but make it fluid and
scroll-driven like equiduct.com's motion (NOT their UI), with tabbed sections, a
Q&A/FAQ, and an "Under development" section that's quick to update. Kill the EvAU
content. Fix the **two logos** (nav + footer is fine, but the nav currently
renders `<Logo>` *and* a separate "STiDY" span → doubled wordmark; use
`<Logo wordmark />` once).

**Design:**
- Scroll-driven sections with GSAP ScrollTrigger / Framer scroll: pinned hero,
  reveal-on-scroll feature sections, parallax mesh. Big, calm animations.
- A **tabbed feature showcase** (Command Center / Study Lab / Focus / Cowork…)
  with an animated preview per tab.
- **FAQ** accordion. **Roadmap / Under development** section driven by a simple
  array in `src/config/roadmap.ts` (status: shipped / in-progress / planned) so
  you or I update one file and it re-renders. Optionally read from a Supabase
  `roadmap` table so you can edit it live from an admin screen later.
- **[DECIDE]** GSAP (richest scroll control, heavier) vs. Framer Motion scroll
  (already a dep, lighter). Recommendation: Framer for now, GSAP only if you
  want the pinned/scrub effects equiduct has.

### 3.6 Coworking overhaul (R1 headline)
**Goal:** make Cowork worth using — its own (upgraded, never downgraded) version
of every app tool, plus social.
**Scope (phased):**
1. **Reliability first** (after §2a): confirm chat/presence/timer live-sync.
2. **Persistence across tab switches:** lift the active room into a store +
   `localStorage` so navigating the app (or switching tabs) doesn't drop you;
   show a persistent "in a room" mini-bar. **[DECIDE]** mini-bar vs. full
   picture-in-picture room.
3. **Whiteboard:** shared canvas (tldraw or a simple Excalidraw-style canvas)
   synced via a `cowork_whiteboard` table or realtime broadcast.
4. **Shared files → Resources:** open/edit a doc together; on save it files into
   Resources under a new "Cowork" category (§3.4). Start with markdown/notes.
5. **Cowork tools:** room-scoped Timetable + Focus (the shared timer already
   exists), and a room Study Lab (shared generated sets).
6. **Social:** friends (requests/accept), presence **status**, invite by link
   (`/coworking?join=CODE`), in-app invite via friends, plus the existing code.
7. **Lobby organization:** public rooms get search + filters + tags and **live
   insert** (subscribe to `cowork_rooms` INSERT so new public rooms appear with
   no reload — partially enabled already by the realtime publication).
**Data:** new tables for `friends`, `cowork_whiteboard`, `cowork_files`; extend
`cowork_members` with `status`. Each needs a migration you run.

### 3.7 First-run onboarding + mascot
**Goal:** a skippable, dynamic guided tour for new accounts; a mascot that shows
you around and becomes the face of the AI assistants.
**Design:**
- **Mascot:** there's already a 🦆 duck reference in the dashboard
  (`DashboardGrid.tsx:200`). **[DECIDE]** lean into the duck as STiDY's mascot
  (recommended — it's already there) vs. design a new character. I can generate a
  mascot set (idle/point/celebrate/think poses) with the brandkit/image skills.
- **Tour engine:** a `useOnboarding` store + a spotlight/coachmark component that
  highlights real UI (sidebar items, search, theme picker, generate button…)
  with the mascot speech-bubbling each step. Persists "completed" per user
  (localStorage + a `profiles.onboarded` flag). Skippable; resumable.
- The mascot becomes the avatar/voice of the assistant chat + Study Lab AI.

---

## Suggested build order (post-review)
1. Confirm §2a (you) → finish §3.6 step 1–2 (Cowork reliability + persistence).
2. §3.2 Flashcards sets (well-scoped, high value).
3. §3.3 + §3.4 Timetable + Resources redesigns (share the filter-bar pattern).
4. §3.1 Per-subject hub.
5. §3.5 Landing redesign.
6. §3.6 rest + §3.7 onboarding/mascot.
