---
type: note
created: 2026-06-14
updated: 2026-06-14
tags:
  - backlog
  - short-term
related:
  - "[[Features to add]]"
  - "[[STiDY]]"
---

# Short Term Ideas

The immediate horizon — what to do next, in order. Keep this tight; promote items to [[Features to add]]
when they're well-specified.

## Next actions
1. **Erick: run the careers/profiles/goals migration** (`supabase/migrations/2026-06-14_careers_profiles_goals.sql`).
   Until then external exams + DB emoji are inert.
2. **PDF-grounded AI** — self-contained, no new decisions, high daily value. Wire `/api/chat` to fetch
   the relevant resource PDF(s) from storage and pass to Gemini as a file part.
3. **Mock EVAU** — timed exam UI + constrained examiner in Study Lab.
4. **Nota de corte / Goals** — Profile aspiring-careers + cutoff scan + simulation (multi-country).

## Quick wins worth slipping in
- Move subject icons to `subjects.icon` and read them in the dashboard server component.
- A "Profile" page stub to host aspiring-careers (ties into #9).
- Apply the grade scale to the remaining `%` dashboard widgets.
- `git init` the `stidy/` app for history + ultrareview.

> [!tip] Sequencing principle
> Fast visible wins first, then the agreed feature, then the ambitious one. Erick is usually watching
> live — see [[Prompt Engineering Guide]].
