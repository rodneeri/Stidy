---
type: reference
created: 2026-06-14
updated: 2026-06-14
tags:
  - reference
  - skills
  - tooling
related:
  - "[[Installed MCP Servers Overview and Status]]"
  - "[[Prompt Engineering Guide]]"
---

# Plugins and Skills Status

Skills and plugins available in this environment, and how I actually use them.

## Plugins

### superpowers
Process discipline. Skills: `brainstorming`, `writing-plans`, `executing-plans`,
`subagent-driven-development`, `test-driven-development`, `systematic-debugging`,
`verification-before-completion`, `requesting/receiving-code-review`, `using-git-worktrees`,
`writing-skills`, `dispatching-parallel-agents`, `finishing-a-development-branch`, `using-superpowers`.
**Used so far:** `brainstorming` (before the animation-polish batch). `verification-before-completion`
is the spirit behind "build green before claiming done."

### claude-obsidian (v1.9.2)
This vault's toolkit. Skills: `wiki`, `save`, `canvas`, `autoresearch`, `wiki-ingest`, `wiki-lint`,
`wiki-query`, `wiki-retrieve`, `wiki-mode`, `wiki-fold`, `wiki-cli`, `obsidian-markdown`,
`obsidian-bases`, `defuddle`, `think`. **Used:** `obsidian-markdown` (building this second brain).
Substrate note: prefer `kepano/obsidian-skills` if installed.

### Design skills
- **impeccable** — frontend design quality (redesign, polish, audit, motion).
- **frontend-design** — distinctive, production-grade UI (avoids generic AI aesthetics).
- **ui-ux-pro-max** — 50+ styles, 161 palettes, 57 font pairings, UX guidelines, charts; shadcn MCP.
  The "Tech Startup" pairing (Space Grotesk + DM Sans + JetBrains Mono) came from here — see
  [[Design Standards]].

## Command skills
`update-config`, `keybindings-help`, `verify`, `code-review`, `simplify`, `fewer-permission-prompts`,
`loop`, `schedule`, `claude-api` (see [[Claude's API Reference]]), `run`, `init`, `review`,
`security-review`.

## Agents (Agent tool)
`general-purpose`, `Explore` (read-only fan-out search), `Plan` (architecture), `fork` (inherits my
context), `claude-code-guide`, `statusline-setup`, and claude-obsidian's `verifier`, `wiki-ingest`,
`wiki-lint`.

> [!tip] Spawn agents only when asked
> Per environment guidance, don't spawn subagents unless Erick explicitly asks or names an agent type.
> Handle multi-part tasks inline with my own tools.

## Status legend
✅ used · 🟡 available, unused · ❌ rejected ([[Installed MCP Servers Overview and Status#Rejected / not installed|Supabase MCP]])
