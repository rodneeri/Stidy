---
type: reference
created: 2026-06-14
updated: 2026-06-14
tags:
  - standards
  - design
  - ui
related:
  - "[[Coding Standards]]"
  - "[[UI Refinement]]"
  - "[[STiDY]]"
---

# Design Standards

The visual language of [[STiDY]]. Vibe target: **Linear × Notion × Cyberpunk** — "expensive, fluid,
immersive." Erick has **acute visual taste**; small flaws (color strain, layout shift, jank, partial
loads) are unacceptable to him.

## Neumorphism everywhere
Every theme is **Soft UI**: `background == surface`, dual light/dark shadows, convex sheen, inner
bevel. `.glass` is an alias of `.neu` (raised). Buttons are physical: `.neu-btn` (convex → hover glow
→ press inset+scale). `.pressable` adds press-in on `:active`. `.lift` = hover-raise for cards.
`.field` = carved inset input. Defined CSS-first in `src/app/globals.css`.

## Tokens
- Colors stored as **raw HSL channels** (`--primary: 28 88% 52%`), consumed `hsl(var(--primary) / <alpha>)`.
  This enables per-user accent overrides at runtime.
- Semantic tokens: background, surface, foreground, muted, border, primary, secondary, accent, ring,
  success, warning, danger, plus glass/mesh blobs, fonts, `--radius`, `--shadow-glow`.
- **Tailwind v4 is CSS-first** — no `tailwind.config.ts`. Tokens live in `@theme inline`; plugins via
  `@plugin`. (See [[Coding Standards]].)

## Themes (5, all distinct)
| id | mode | accent | character |
|----|------|--------|-----------|
| `nexus` *(default)* | light | warm amber + coral | cream surface |
| `soft` | light | cool blue + teal | calm |
| `soft-dark` | dark | cyan + teal | calm dark |
| `cyber` | dark | neon green + lime | mono, JetBrains |
| `metal` | light | TE orange | brushed aluminium, engraved labels |

> [!danger] No purple / no pink
> Erick explicitly rejected purple/pink palettes (and the Supabase-MCP and paid-API routes). Stay in
> the **cool teal + warm amber** family. The `/showcase` demo keeps intentional purple — that's NOT
> the app theme.

## Typography
- **Space Grotesk** — display/headings/logo (`--font-grotesk`)
- **DM Sans** — UI/body (`--font-dmsans`)
- **JetBrains Mono** — data / Cyber theme (`--font-jbmono`)
- Logo: ascending bars (grade/progress growth) in a gradient squircle; wordmark "STiDY" with a
  lowercase **i** tinted in `--primary` (the signature).

## Motion vocabulary (`lib/motion.ts`)
One source of truth so everything feels like one physical system:
- `easeOut = [0.22, 1, 0.36, 1]`; `dur` = fast `0.18` / base `0.3` / slow `0.45`
- `spring` = `pop` (modals/popovers), `slide` (layout/nav pill), `magnetic` (cursor buttons)
- variants: `fadeRise`, `staggerParent`, `staggerChild`
- `Stagger`/`StaggerItem` for list cascade + exit-on-delete; `FadeIn` for whole-content reveal.
- **Respect reduced motion** via `MotionConfig reducedMotion="user"` + the CSS killswitch.

> [!tip] Loading aesthetic (Erick's preference, 2026-06-14)
> **Don't show anything until data is ready, then reveal the whole thing quickly.** No skeleton
> flashes. Managers: `if (loading) return null`, then wrap content in a quick `FadeIn`.

## Identity propagation
Subjects have an emoji icon (`SubjectIcon`, local store today → DB column next). Show it
**everywhere** the subject is referenced: Grade Engine, Resources folders, Timetable, Study Lab,
Subjects cards. See [[UI Refinement]].
