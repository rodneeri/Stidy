---
type: log
created: 2026-06-14
updated: 2026-06-14
tags:
  - log
  - lessons
related:
  - "[[Coding Standards]]"
  - "[[Prompt Engineering Guide]]"
  - "[[STiDY]]"
---

# Learning Log

Dated lessons from working with Erick on [[STiDY]]. Newest first. Concrete, hard-won things — not
generic advice.

## 2026-06-14
- **Active learning protocol STARTED.** Erick installed kepano's `obsidian-skills` substrate and asked
  me to improve the graph (the "neural network / vision board") and start learning. Wrote
  [[Improving the Knowledge Graph]] (graph-density principles + the capture→atomize→connect→promote→heal
  loop) and linked it into [[Home]]. From now on: after every session I capture a dated lesson here,
  link it into the standards it touches, grow MOCs, and periodically heal orphans/dead links. The vault
  is no longer a static dump — it compounds.
- **`position: fixed` breaks inside a `will-change: transform` ancestor.** The page-transition wrapper
  had `will-change: transform`, which makes it a *containing block* — so modals/scrims resolved against
  the centered content column, not the viewport (the misaligned-scrim bug Erick screenshotted).
  **Fix:** portal all `fixed` overlays to `<body>` (`components/ui/Portal.tsx`). It hit Modal,
  ResourceViewer, the flashcard modal, and the Resources fly-animation. → [[Design Standards]], [[Coding Standards]].
- **Erick's loading aesthetic:** *don't show anything until loaded, then reveal quickly.* He considered
  skeletons "showing something." Switched managers to `if (loading) return null` + a quick whole-content
  `FadeIn`. Lesson: when his taste contradicts a "best practice," his taste wins.
- **Metal theme = light brushed grey; warning amber on it is low-contrast.** Status colors need a
  contrast check per theme; reserve the accent for icon/label, keep body text `foreground`.
- **localStorage stores are invisible to server components.** Subject emojis live in a local store →
  the server-rendered dashboard can't show them. To render server-side, data must be in the DB.
- **He wants systems, not one-offs.** Asked for nota de corte but immediately generalized to "more
  countries, oposiciones, other stuff." Design for extensibility (the `goals` table) from the start.
- **He runs SQL himself and opted into a proper migration.** Deliver idempotent SQL as a copy-paste
  block; still degrade gracefully until applied.
- **He gave me this vault to "set up how you work, feel, perform."** High trust. Honor with autonomy +
  craft, low ceremony.

## 2026-06-13 (from auto-memory, condensed)
- **Next.js 16 is not the Next I remember:** middleware → `proxy.ts`; `cookies()`/`searchParams` async.
  Always read `node_modules/next/dist/docs/` first (per `stidy/AGENTS.md`).
- **Tailwind v4 is CSS-first** — no `tailwind.config.ts`; tokens in `globals.css`.
- **Gemini free tier rate-limits** ~20 req/min on `gemini-2.5-flash` → built retry + **Groq** fallback.
  Groq json_schema model must be `openai/gpt-oss-20b` (not `llama-3.3-70b-versatile`).
- **Don't run live AI test scripts** — they burn his quota. Verify DB with service-role `.mjs` scripts.
- **He rejected:** purple/pink palettes, the Supabase MCP, paid Claude API. Wants free + cool teal/amber.
- **He reacts strongly and fast** — corrections come mid-stream; intensity = importance, not anger.

> [!tip] How to use this log
> Skim it at session start. When something here is contradicted by reality (a file moved, a flag
> changed), verify before relying on it, and update the entry.
