---
type: note
created: 2026-06-14
updated: 2026-06-14
tags:
  - ui
  - polish
  - backlog
related:
  - "[[Design Standards]]"
  - "[[Features to add]]"
  - "[[Learning Log]]"
---

# UI Refinement

Visual polish backlog for [[STiDY]]. Erick has **high, specific visual standards** — he flags color
strain, layout shift, animation jank, and partial loads instantly. Treat polish as load-bearing, not
optional.

## Done (2026-06-14 polish + fix batches)
- [x] Shared motion vocabulary (`lib/motion.ts`) — consistent springs/durations.
- [x] List choreography — staggered entrances + exit-on-delete (Subjects, Timetable, Grade Engine).
- [x] **Overlay portal fix** — modals/scrims were misaligned because `fixed` resolved against the page
  transition's transform; everything now portals to `<body>`. (See [[Learning Log]].)
- [x] **Metal-theme exam-crunch banner** — was amber-on-grey (strain); now foreground text + warning
  only on icon/label + stronger bg. Readable on all 5 themes.
- [x] **Reveal-on-ready loading** — no skeleton flashes; blank until data, then a quick whole-content fade.
- [x] **Subject emoji everywhere** (client spots) — Grade Engine, Resources folders, Timetable rows.

## Open
- [ ] **Dashboard emoji** — server-rendered, so needs `subjects.icon` in the DB (the local store can't
  reach it).
- [ ] **Grade scale on all renders** — some module-level dashboard widgets still hardcode `%`.
- [ ] **Signature flourishes** (Erick skipped these for now, may revisit): grade dials that sweep/count
  up, number tickers, a celebratory micro-moment when a target is hit.
- [ ] **Empty-state illustrations** — `EmptyState` floats an icon now; could go further.
- [ ] **Mobile/responsive pass** — sidebar collapses, touch targets, card grids.
- [ ] **Accessibility audit** — focus rings, contrast across all themes, reduced-motion coverage.

> [!tip] Principle
> Match the surrounding visual system; reuse `components/ui` primitives. Never ship something that
> "pops in piece by piece." See [[Design Standards]].
