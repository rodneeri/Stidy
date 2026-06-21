# STiDY design system — how to build with it

STiDY is a warm, tactile **neumorphic + glass** study app. Components import from
`window.Stidy.*` and are styled by `styles.css` (Tailwind v4 utilities + the
custom classes below). No provider or wrapper is required — the default `nexus`
theme is defined on `:root`.

## Theming
Switch themes by setting `data-theme` on any ancestor (default is `nexus`):
`nexus` (warm paper), `soft`, `soft-dark`, `cyber`, `metal`, `aurora`, `sunset`.
Colors are HSL token triplets consumed as `hsl(var(--token))`. Real tokens:
`--primary`, `--primary-foreground`, `--secondary`, `--background`,
`--foreground`, `--muted`. Use the Tailwind utilities `text-primary`,
`text-muted`, `text-foreground`, `bg-primary`, `border-primary` etc. There is no
`--card` token — use the surface classes below for cards, not `bg-card`.

## The styling idiom — STiDY's signature classes
Use these for surfaces and controls instead of plain borders/shadows; they are
what make it look like STiDY:
- `.neu` — raised neumorphic surface (soft dual shadow). The default card.
- `.neu-inset` — carved/pressed-in surface (wells, tracks, chips).
- `.neu-btn` — pressable neumorphic button (presses on `:active`).
- `.glass` — frosted translucent card (backdrop blur), for overlays/panels.
- `.field` — text input / control surface (focus ring built in).
- `.pressable` — adds press-down feedback to any clickable element.
Round corners generously (`rounded-xl`/`rounded-2xl`) and keep spacing airy.

## Where the truth lives
Read `styles.css` (it `@import`s `_ds_bundle.css`, which carries every token and
the `.neu/.glass/.field` definitions) before styling new layout.

## Build snippet
```tsx
import { Mascot, Toggle, Dial, EmptyState } from "window.Stidy"; // via the bundle
// A STiDY-flavored panel: glass card, neu controls, primary accents.
<div className="glass max-w-md rounded-2xl p-6 space-y-4">
  <div className="flex items-center gap-3">
    <Mascot size={48} />
    <h2 className="text-lg font-semibold text-foreground">Welcome back</h2>
  </div>
  <Dial value={72} />
  <Toggle checked onChange={() => {}} label="Daily reminder" />
  <button className="neu-btn pressable w-full rounded-xl py-2 text-primary font-medium">
    Start studying
  </button>
</div>
```

Components like `Modal`, `EmojiPicker`, and `DateTimePicker` are importable and
fully functional even where the preview card shows a minimal/floor state.
