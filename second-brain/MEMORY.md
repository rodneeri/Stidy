---
type: memory-hub
created: 2026-06-14
updated: 2026-06-14
tags:
  - meta
  - memory
  - moc
aliases:
  - Memory
  - Master Memory
---

# 🧠 MEMORY

> [!abstract] What this file is
> The **single catch-all memory log** for everything Claude learns working with Erick — small or big.
> Anything worth remembering lands here first: decisions, preferences, facts, gotchas, half-ideas,
> session events. Durable facts are **pinned** at the top; everything else flows into the
> **[[#📜 Capture Log]]** (newest first). Structured knowledge lives in linked notes — this file is the
> spine that ties them together. Start at [[Home]] for the map; come **here** for raw memory.

> [!tip] Capture rule — write it down, always
> If there is even a 1% chance a detail matters later, append it to the Capture Log. Cheap to write,
> expensive to lose. Atomize and promote the important ones into [[Learning Log]] or the relevant
> standard later. **When in doubt, capture.**

---

## 📌 Pinned — durable facts

> [!note] Identity & context
> - **User:** Erick — `erickr01@ucm.es` (app/personal account: `erkgraff@gmail.com`)
> - **Who:** CS / medicine-adjacent student at **UCM (Madrid)**; bilingual EN + ES.
> - **Context:** Spanish academic system — EVAU, bachillerato, cuatrimestre, oposiciones.
> - **Machine:** Windows 11, PowerShell (primary) + Bash tool. Working dir under `C:/Users/Erick/Downloads/Claude Projects`.
> - **Live vault:** `C:/Users/Erick/Documents/Obsidian/STiDY` (this vault). Staging copy of these notes also in `Downloads/Claude Projects/second-brain`.
> - **Assistant:** Claude (currently **Opus 4.8**). Date anchor: **2026-06-14**.

> [!note] How Erick works (read [[Prompt Engineering Guide]] for the full version)
> - Direct. Batches big multi-part requests. Wants **autonomous execution** — act when you can, ask only on genuine forks.
> - High visual taste; cares about polish and design.
> - Wants **verify-before-claim**: run it, show output, do not assert success blindly.
> - Bilingual; STiDY ships **EN + ES**.

> [!note] Memory architecture (two layers, mirrored by hand)
> 1. **Auto-memory** (always loaded into Claude's context): the `.claude` memory folder → `MEMORY.md` index + per-fact files.
> 2. **This Obsidian vault**: the human-facing, visual, graph-linked mirror — this `MEMORY.md` is its memory spine.
> - ⚠️ The two are **not auto-synced**. After meaningful sessions, mirror durable facts both ways.
> - Transport: **Obsidian CLI v1.12.7** or direct filesystem. No MCP/REST Obsidian server installed.

---

## 🔭 Active threads — current state

> [!todo] STiDY (active project) — see [[STiDY]]
> - Premium academic OS Erick is building. Stack/status detailed in [[STiDY]] and [[Tech Stack]].
> - Jun 2026 feature batch: several items done; **#9, #12, #14 pending** (per auto-memory stidy-feature-batch).
> - Design system: neumorphism + tokens + 5 themes — see [[Design Standards]].

> [!todo] Vault learning protocol (started 2026-06-14)
> - After every session: add a dated lesson to [[Learning Log]], link it into affected standards, grow MOCs, heal orphans/dead links periodically.
> - Goal: a denser knowledge graph (the neural-network / vision-board view = Obsidian graph view).

---

## 🗂️ Index of structured memory

What gets promoted out of the log lives here.

| Area | Note |
|---|---|
| Map of everything | [[Home]] |
| How Erick prompts / wants output | [[Prompt Engineering Guide]] |
| Dated lessons (atomic) | [[Learning Log]] |
| Code conventions | [[Coding Standards]] |
| Visual system | [[Design Standards]] |
| Stack & versions | [[Tech Stack]] |
| Claude/Anthropic API | [[Claude's API Reference]] |
| MCP servers | [[Installed MCP Servers Overview and Status]] |
| Plugins & skills | [[Plugins and Skills Status]] |
| Active project | [[STiDY]] |
| Ideas (loose → durable) | [[Ideas and Brainstorm]] · [[Features to add]] · [[Short Term Ideas]] · [[Possible Features to add in the Long Term]] |

---

## 📜 Capture Log

> Newest first. Format: `### YYYY-MM-DD — title` then a few bullets. Tag with #decision,
> #preference, #bug, #idea, #fact, #session. Promote the durable ones upward when they prove out.

### 2026-06-14 — MEMORY.md created `#session` `#decision`
- Erick asked for a single Obsidian file to keep memory of every detail, small or big.
- Built this `MEMORY.md` at the vault root as the catch-all memory hub: pinned durable facts + active threads + structured index + chronological Capture Log.
- Confirmed the memory stack is live: Obsidian CLI **v1.12.7** installed; live vault is the only registered vault; auto-memory loads each session. The two layers are **not** auto-synced — mirror manually.
- Gotcha learned: tool filesystem writes outside the working dir are sandbox-blocked, so the live vault must be written through the **Obsidian CLI** (`create` / `append`), not Write/Copy-Item.
- Decision: this file is the read-me-first for raw memory; [[Home]] stays the navigational MOC. New details land here, then get atomized/promoted into [[Learning Log]] and standards.

<!-- Append new entries ABOVE this line, directly under the heading, newest first. -->
