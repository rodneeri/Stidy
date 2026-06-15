# STiDY — Final Animation Polish (#14)

Date: 2026-06-14
Status: approved, in progress

## Goal
A final motion-polish pass over the already-built app. Three workstreams, all
additive and low-risk, no new deps, no SQL. Respects the existing
`prefers-reduced-motion` killswitch in globals.css.

## Workstream 1 — Consistency & feel (shared motion vocabulary)
Problem: timings/springs are scattered (FadeIn 0.5s, PageTransition 0.32s, four
distinct spring configs).

- New `src/lib/motion.ts`: `easeOut` curve; `dur` (fast 0.18 / base 0.3 / slow 0.45);
  `spring` (`pop`, `slide`, `magnetic`); variants `fadeRise`, `staggerParent`,
  `staggerChild`.
- Refactor consumers to import these: FadeIn, PageTransition, Modal, Dropdown,
  MagneticButton, Sidebar. FadeIn drops 0.5→0.3 to match page transitions.

## Workstream 2 — List choreography
- New `src/components/motion/Stagger.tsx`: `Stagger` container + `StaggerItem`
  (children cascade ~40ms apart via the shared variants).
- Wrap high-traffic card lists so they cascade in on load and animate out on
  delete (AnimatePresence + `layout` so neighbors slide to fill): Subjects grid,
  Resource folders, Tasks groups, Grade Engine subject list.

## Workstream 3 — Loading & empty states
- New `src/components/ui/Skeleton.tsx` (reuses `.skeleton` shimmer): card / row /
  dial variants. Show while client managers fetch (Subjects, Resources, Grade
  Engine, Timetable) to remove the blank-then-snap flash.
- Animated empty states: existing text empty states get a gently floating icon
  (reuse `float` keyframe) + fade-in.

## Out of scope (YAGNI)
Signature flourishes (count-ups/confetti), new dependencies, schema/SQL changes.

## Verification
`next build` after each workstream; manual check of dev server for regressions.
