# STiDY design-sync notes

## Repo shape — this is an APP, not a component library
- No published `dist`/`exports`; the converter runs in **synth-entry mode** from `src/`.
- `node_modules/stidy` is a hand-made fake package so `PKG_DIR` resolves: a real
  dir containing `package.json` (copied), `tsconfig.json` (copied), `_ds.css`
  (the compiled stylesheet, copied) and a **junction `src` → repo `src`**.
  **Recreate per clone** (PowerShell):
  ```pwsh
  $r="<repo>"; $p="$r\node_modules\stidy"
  New-Item -ItemType Directory $p -Force
  Copy-Item "$r\package.json","$r\tsconfig.json" $p
  New-Item -ItemType Junction (Join-Path $p src) -Target "$r\src"
  Copy-Item "$r\.design-sync\assets\stidy.css" "$p\_ds.css"
  ```
  Do **not** junction the whole repo to `node_modules/stidy` — it recurses
  (`stidy/node_modules/stidy/…`) and OOMs the dts parse (~18 min then crash).
- `cfg.srcDir = "src/components/ui"` so the scan only sees the 14 presentational
  UI files. Scanning all of `src/` pulls in Supabase/Next feature components that
  don't bundle standalone (and re-includes `app/layout.tsx` → katex CSS, below).

## CSS
- `cfg.cssEntry = "_ds.css"` (PKG_DIR-relative). Built with Tailwind v4 CLI:
  `npx @tailwindcss/cli@4 -i src/app/globals.css -o .design-sync/assets/stidy.css`
  then a Google-Fonts `@import` (Inter + Merriweather) is **prepended** so
  `[FONT_MISSING]` becomes `[FONT_REMOTE]`. Re-copy to `node_modules/stidy/_ds.css`
  after any regen. The default theme `nexus` lives on `:root`, so previews render
  styled with no provider/wrapper.

## Excluded / floor-card components
- `MathText` (excluded): imports the `katex` JS, and its CSS pulls `.ttf` fonts
  the converter's esbuild has no loader for → bundle fails. Re-add only with a
  font-loader override.
- `Portal` (excluded): non-visual (renders children into a portal).
- `Modal`, `EmojiPicker`, `DateTimePicker`: **floor cards** — overlay/interaction
  components. (EmojiPicker/DateTimePicker still render their closed trigger.)

## Known render warns (benign — do NOT treat as new on re-sync)
- `[RENDER_THIN] ConfirmDelete` — icon-only trash button, no text by design.
- `[RENDER_THIN] Mascot` — pure SVG, no text. Both paint fine (confirmed on the
  contact sheet).

## Re-sync risks
- The `node_modules/stidy` junction + copied `_ds.css`/`tsconfig.json` are **not
  committed** (they're inside node_modules) — recreate them (above) before any
  re-sync, and rebuild `_ds.css` if `globals.css` changed.
- Bundle is ~995 KB (framer-motion + lucide inlined) — expected for synth mode.
- New UI components added under `src/components/ui/` are auto-picked-up; prune
  non-visual/interaction ones via `componentSrcMap: {Name: null}` and author a
  preview in `.design-sync/previews/<Name>.tsx`.
