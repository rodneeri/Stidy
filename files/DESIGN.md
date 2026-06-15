---
name: DUPLiiST
description: Premium dark playlist-migration & downloader interface — aurora glow as both atmosphere and signal.
colors:
  primary: "#8b5cf6"
  primary-light: "#a78bfa"
  primary-deep: "#6d28d9"
  primary-dim: "#1a1230"
  secondary: "#22d3ee"
  secondary-dim: "#0a2d3a"
  success: "#4ade80"
  success-dim: "#0a2510"
  warning: "#fbbf24"
  warning-dim: "#2d2310"
  danger: "#f87171"
  danger-dim: "#2a1a20"
  spotify: "#1db954"
  youtube: "#ff4444"
  soundcloud: "#ff7700"
  void: "#06060f"
  bg-alt: "#0b0b1a"
  surface: "#0d0d20"
  surface-alt: "#15152a"
  surface-high: "#1c1c35"
  border: "#1f1f3a"
  border-high: "#2d2d4f"
  divider: "#16162a"
  ink: "#f1f5f9"
  ink-soft: "#cbd5e1"
  muted: "#64748b"
  muted-deep: "#475569"
  glow-fill: "#8b5cf60f"
  glow-border: "#8b5cf62e"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "2.8rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-2px"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.87rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.74rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  chip: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "100px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.78rem 1.3rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "#ffffff"
  button-action:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: "0.78rem 0.4rem"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.78rem 1.1rem"
  card-glass:
    backgroundColor: "{colors.glow-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  pill-status:
    backgroundColor: "{colors.primary-dim}"
    textColor: "{colors.primary-light}"
    rounded: "{rounded.pill}"
    padding: "0.22rem 0.55rem"
  chip-source:
    backgroundColor: "{colors.youtube}"
    textColor: "{colors.youtube}"
    rounded: "{rounded.chip}"
    padding: "0.16rem 0.38rem"
---

# Design System: DUPLiiST

## 1. Overview

**Creative North Star: "The Aurora Control Deck"**

DUPLiiST is a deep-space premium cockpit for moving music between platforms. The canvas is a near-black void (`#06060f`); above it drift aurora-grade blooms of electric violet and signal cyan. That light is never wallpaper — it is the instrument panel. Every glow, every gradient sweep, every pulse is doing a job: reporting a track's state, guiding the eye to the next action, or marking a brand moment. The product should feel like a $20k piece of software the first second a stranger sees it, and it earns that read through fluid, cinematic motion and disciplined, luminous color rather than through ornament.

The system is **cinematic and alive**. The splash is an opening title sequence — a violet/cyan glow blooms, a conic ring sweeps, the credits card zooms and de-blurs into focus over 2.6 seconds, then dissolves. Inside the app, rows stagger in like a dealing hand, status pills *pop* the instant they change, thumbnails lift on hover, the progress bar shimmers while it works. Motion uses exponential ease-out (`cubic-bezier(.16,1,.3,1)`) for fluid entrances and a controlled spring (`cubic-bezier(.34,1.56,.64,1)`) for state-change pops. Energy is the point — but every animation must still resolve to information or attention, never just decoration.

This system explicitly rejects three things, drawn straight from the product's anti-references. It is **not** a generic dev tool — no bare forms, no default browser styling, no inert page. It is **not** cheap — no gratuitous gradients or glows that fail to serve hierarchy or feedback. And it is **never** a sketchy downloader site — no aggressive ads, no dark patterns, no confusing CTAs. Because this product touches user credentials and copyrighted content, *trust is a visual requirement*, and trust here is built from precision, legibility, and restraint underneath the spectacle.

**Key Characteristics:**
- Void-black canvas (`#06060f`) with drifting aurora violet/cyan blooms behind a precise interface.
- Glow is the depth language — colored light bloom and glassmorphism, never flat gray drop shadows.
- Glassmorphism cards with a luminous violet hairline along the top edge.
- Choreographed, fluid motion: a cinematic splash, staggered rows, spring-popped state changes.
- Color-coded status pills make every track state scannable at a glance.
- Per-source brand colors (Spotify green, YouTube red, SoundCloud orange) reserved strictly for their platforms.
- Single workflow spine: paste → resolve → select → convert/download, kept obvious under the polish.

## 2. Colors

A high-contrast dark palette where two luminous accents (violet, cyan) carry the brand against a void-black neutral spine, with a small, strict set of functional and per-source signal colors.

### Primary
- **Electric Violet** (`#8b5cf6`): The product's spine. Every primary button, focus ring, card border, active toggle, "found" status, and the live source-pill glow. If an element is interactive and important, it is violet.
- **Amethyst** (`#a78bfa`): The lighter violet for text-on-dark accents — section labels, active toggle text, "found" pill text, links. Used where solid violet would be too heavy on small type.
- **Royal Violet** (`#6d28d9`): The deep end of the primary button gradient (`linear-gradient(135deg, #8b5cf6, #6d28d9)`) and pressed states.

### Secondary
- **Signal Cyan** (`#22d3ee`): The counterpoint to violet and the far end of the brand gradient. Reserved for completion and download moments — the Download action, the "downloaded" status pill, and the success bloom that fires when a track lands. Cyan means *done*.

### Tertiary
Functional signal colors, used only on state — never as decoration:
- **Emerald** (`#4ade80`): The `.m3u` export action and positive-progress accents.
- **Amber** (`#fbbf24`): "Searching/waiting" state and the **Resume** button; the open-folder action.
- **Coral** (`#f87171`): Errors — failed search, failed download, the **Stop** button, the retry affordance.

Per-source brand colors, reserved exclusively for their platform:
- **Spotify Green** (`#1db954`) · **YouTube Red** (`#ff4444`) · **SoundCloud Orange** (`#ff7700`): Used in source pills, source badges, and convert-target icons. Never repurposed for general UI accenting.

### Neutral
- **Void** (`#06060f`): The body. The deep-space floor everything floats on.
- **Surfaces** (`#0b0b1a`, `#0d0d20`, `#15152a`, `#1c1c35`): Drawer, modal box, card-alt, raised fills — a tonal ladder, each step a touch lighter than the last.
- **Borders** (`#1f1f3a` / `#2d2d4f`) & **Divider** (`#16162a`): Hairline structure; most "borders" in practice are the translucent violet `glow-border` (`#8b5cf62e`).
- **Ink** (`#f1f5f9`) & **Ink Soft** (`#cbd5e1`): Primary and secondary text.
- **Muted** (`#64748b`) & **Muted Deep** (`#475569`): Labels, captions, placeholders, legal copy. *Contrast caution* — see Don'ts.
- **Glow Fill** (`#8b5cf60f`) & **Glow Border** (`#8b5cf62e`): The translucent violet wash that makes glass cards and surfaces feel lit from within.

### Named Rules
**The Glow-Is-Signal Rule.** Light always reports state or guides attention. If a glow doesn't change with state and you could delete it without losing information, it's decoration — cut it.

**The Source-Truth Rule.** Spotify green, YouTube red, and SoundCloud orange are reserved for their platforms. They never become generic UI accents. The badge color *is* the source.

**The Violet-Cyan Polarity Rule.** Violet is *action and identity*; cyan is *completion*. The brand gradient runs violet → cyan because that is the literal journey of the product: start the migration, finish the download.

## 3. Typography

**Display Font:** System sans (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`)
**Body Font:** Same system sans stack.
**Label/Numeric:** Same family; numerics use `font-variant-numeric: tabular-nums`.

**Character:** A single, neutral, technical system sans across the whole interface. This is deliberate — the typography stays quiet and razor-legible so that *color and motion carry the personality*. The one expressive typographic moment is the wordmark.

### Hierarchy
- **Display** (800, `2.8rem`, line-height 1, `-2px` ≈ `-0.045em`): The DUPLiiST wordmark only. "DUPLi" in a silver gradient, "iST" in the violet→cyan brand gradient with a glowing underline. Drops to `2.3rem` under 540px.
- **Headline** (700, `1rem`): Playlist name, modal titles, drawer header.
- **Title** (600–700, `0.85–0.92rem`): Convert-option names, candidate titles, action labels.
- **Body** (400–500, `0.83–0.87rem`, line-height 1.55): Input text, track titles, descriptions. Track text truncates with ellipsis rather than wrapping.
- **Label** (700, `0.7–0.74rem`, `0.06em` tracking, uppercase, amethyst): Drawer section headers (e.g. "🔑 CREDENCIALES DE SPOTIFY"). Small, muted captions share the size at weight 400–500 without uppercasing.

### Named Rules
**The Gradient-Wordmark Rule.** Gradient text (`background-clip: text`) is reserved for exactly two places: the DUPLiiST wordmark and the footer brand mark. It is forbidden on headings, body, labels, and buttons. The gradient is a logo treatment, not a text style.

**The Tabular-Time Rule.** All durations and numeric counts use `tabular-nums` so columns never jitter as values change during live search.

## 4. Elevation

This system has **no traditional shadows**. Depth is built from two materials: **colored glow** (a light bloom matched to an element's own accent) and **glass** (translucent violet-tinted fills over `backdrop-filter: blur`). A neutral gray drop shadow anywhere in this UI is a bug — it reads "2014 app" and breaks the aurora language instantly.

### Shadow Vocabulary (all glow, not shade)
- **Focus Ring** (`box-shadow: 0 0 0 3px rgba(139,92,246,.1)` + violet border): Every focused input. A soft violet halo, not a hard outline.
- **Primary Glow — rest** (`box-shadow: 0 0 20px rgba(139,92,246,.35)`): The violet gradient buttons at rest, lit from within.
- **Primary Glow — hover** (`box-shadow: 0 0 32px rgba(139,92,246,.55)`): The same button, glow intensified, lifted `translateY(-1px)`.
- **Action Glow** (`box-shadow: 0 0 16px rgba(<accent>,.2)`): Ghost action buttons on hover, the glow color-matched to each button's role (violet/cyan/emerald/amber).
- **Success Bloom** (`box-shadow: 0 0 14px 2px rgba(34,211,238,.45)`): Fires once on the "downloaded" pill when a track completes. Cyan, brief, celebratory.
- **Splash Lift** (`box-shadow: 0 30px 90px -20px rgba(139,92,246,.45), 0 10px 40px rgba(0,0,0,.6)`): The only place a dark shadow appears, and only paired with a violet one, to seat the cinematic splash card in space.

### Glass Vocabulary
- **Card glass:** `backdrop-filter: blur(24px)` over `glow-fill`, with a `glow-border` and a violet hairline gradient along the top edge.
- **Toast / overlay:** `blur(20px)` / `blur(5px)` respectively.

### Named Rules
**The Colored-Light Rule.** Elevation is a glow matched to the element's own accent. Neutral gray box-shadows are forbidden.

**The Glass-Surface Rule.** Primary containers are translucent glass — violet-tinted fill plus blur — so the void shows through. Surfaces are lit, not stacked.

## 5. Components

Every interactive surface shares one grammar: rounded geometry, a violet-or-functional accent, a glow on hover, and a spring scale (`scale(.94)`) on press.

### Buttons
- **Shape:** Rounded (`11–12px` for rectangular buttons, `100px` for toggle/format pills).
- **Primary** (Search, Save): Violet gradient (`linear-gradient(135deg, #8b5cf6, #6d28d9)`), white text, resting violet glow, padding `.78rem 1.3rem`. The Search button morphs in place: **Stop** (coral gradient) during active search, **Resume** (amber gradient) when paused.
- **Hover / Focus:** `translateY(-1px)`, glow widens from 20px → 32px. Press: `scale(.94)`.
- **Action buttons (ghost):** Transparent fill, `1px` colored border, accent text, color-coded by function — violet = Convert, cyan = Download, emerald = Export .m3u, amber = Open folder. On hover: faint accent fill + matched glow + lift. Disabled: 35% opacity, no transform/glow. The Download button breathes with a slow `dl-pulse` ring when enabled.
- **Retry** (failed downloads): Coral ghost, faint coral fill on hover.

### Chips & Pills
- **Source pill** (header): Pill (`100px`), colored text + 30%-alpha border + 8%-alpha fill in the source color, with a `currentColor` dot that pulses (`pulse 2s`) to read "live".
- **Source badge** (track row): Tiny (`6px` radius) `YT` / `SC` chip in the source color.
- **Format / Quality toggle** (`fqp`): Pill, muted at rest; active state gets a violet fill + border + amethyst text and a `pop-in` spring.

### Status Pill — *signature component*
The heart of "status legibility at a glance." A `100px` pill, min-width 84px, weight 700, that names a track's state in one color-coded token: `· Pendiente` (muted), `⏳ Buscando` (amber on `warning-dim`), `✓ Encontrado` (amethyst on `primary-dim`), `✗ No encontrado` / `✗ Error` (coral on `danger-dim`), `⬇ Ya descargado` (cyan on `secondary-dim`). On any change it fires a `pill-pop` spring; the "downloaded" transition adds the cyan success bloom. This pill is the instrument readout of the whole deck — keep it instantly scannable and never let a state go uncolored.

### Cards / Containers
- **Corner Style:** `16px` (`rounded.lg`).
- **Background:** Glass — `glow-fill` over `backdrop-filter: blur(24px)`.
- **Top accent:** A `::before` 1px gradient hairline (`transparent → rgba(139,92,246,.4) → transparent`) along the top edge — the signature "lit from above" line.
- **Border:** `glow-border` (`#8b5cf62e`). **Internal padding:** `1.35rem` for input cards; list cards run edge-to-edge.

### Inputs / Fields
- **Style:** Translucent dark fill (`rgba(255,255,255,.04)`), `1px` faint border, `8–11px` radius.
- **Focus:** Violet — border shifts to `rgba(139,92,246,.5)`, a `3px` violet halo ring appears, and the fill tints faintly violet. No hard outline.
- **Placeholder:** `muted-deep` (see contrast caution in Don'ts).

### Navigation
There is no nav bar — the app is a single vertical workflow (`max-width: 820px`, centered). Settings live in a **right slide-in drawer** (`380px`, `cubic-bezier(.4,0,.2,1)`) opened by a glowing gear button; secondary flows (match picker, convert) are **centered modals** that fade + rise (`translateY(16px) scale(.98) → 0`). Both sit on a `blur(5px)` scrim. On mobile the drawer goes full-width.

### Splash — *signature component*
The cinematic opening title sequence. Over 2.6s with `cubic-bezier(.16,1,.3,1)`: a radial violet/cyan glow scales up, a masked grid fades in, a conic-gradient ring (`violet → cyan → amethyst → violet`) sweeps 220°, and the credits card zooms from `scale(.8)` + `blur(18px)` to crisp focus, then the whole sequence dissolves. Keep it **super smooth** — this is the first impression that makes a stranger read the product as premium. If `credits.png` is missing, it self-skips.

## 6. Do's and Don'ts

### Do:
- **Do** keep the void-black canvas (`#06060f`) and let the aurora violet/cyan blooms breathe behind a precise interface.
- **Do** express all depth as colored glow matched to the element's own accent, plus glassmorphism. Light, not shade.
- **Do** make motion fluid and cinematic — exponential ease-out (`cubic-bezier(.16,1,.3,1)`) for entrances, spring (`cubic-bezier(.34,1.56,.64,1)`) for state pops — and keep the splash super smooth.
- **Do** give every track state a color-coded status pill, and keep the paste → resolve → select → convert/download spine obvious under the polish.
- **Do** reserve Spotify green, YouTube red, and SoundCloud orange for their platforms only.
- **Do** confine gradient text to the DUPLiiST wordmark and footer mark.
- **Do** add a `@media (prefers-reduced-motion: reduce)` fallback (crossfade or instant) for every animation — splash, blobs, row stagger, pill pops. *This is currently missing and must be closed before ship.*
- **Do** keep display letter-spacing at or above `-0.04em`.

### Don't:
- **Don't** ship the generic dev-tool look — bare forms, default browser styling, no motion, no personality. *(PRODUCT.md anti-reference.)*
- **Don't** add gratuitous gradients or glows that don't serve hierarchy or feedback. Every glow must report state or guide attention. *(PRODUCT.md anti-reference.)*
- **Don't** let anything read as a sketchy/dodgy downloader site — no aggressive ads, no dark patterns, no confusing CTAs. Trust is the priority. *(PRODUCT.md anti-reference.)*
- **Don't** use gradient text on any heading, label, body, or button — wordmark only.
- **Don't** introduce flat gray drop shadows. If it looks like a 2014 app, the shadow is gray and the glow is missing.
- **Don't** use `border-left`/`border-right` greater than 1px as a colored accent stripe. Cards carry their accent as a full glow-border + top hairline, never a side stripe.
- **Don't** rely on muted-deep (`#475569`) or muted (`#64748b`) for anything that must be read — small legal/placeholder copy at `.71rem` in `#475569` on the void fails the 4.5:1 contrast floor. *(Accessibility is deprioritized this phase, but bump toward `ink-soft` the moment it isn't.)*
