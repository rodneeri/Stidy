---
type: reference
created: 2026-06-14
updated: 2026-06-14
tags:
  - reference
  - mcp
  - tooling
related:
  - "[[Plugins and Skills Status]]"
---

# Installed MCP Servers Overview and Status

MCP servers connected to this Claude Code environment. **All are deferred** — their tool schemas load
on demand via `ToolSearch` (query `select:<tool_name>`) before they can be called. None have been used
in [[STiDY]] work yet, but they're available.

> [!info] How to use a deferred tool
> 1. `ToolSearch` with `select:mcp__claude_ai_Gmail__list_labels` (or keyword search).
> 2. The schema loads into context.
> 3. Call it like any normal tool.

## Servers

### 📧 Gmail (`mcp__claude_ai_Gmail__*`)
Drafts (`create_draft`, `list_drafts`), labels (`create/update/delete/list_labels`,
`label/unlabel_message`, `label/unlabel_thread`), threads (`search_threads`, `get_thread`).
**Status:** available, unused. Potential STiDY use: send the exam-extension emails the Timetable
already drafts.

### 📅 Google Calendar (`mcp__claude_ai_Google_Calendar__*`)
`create/update/delete/get/list_events`, `list_calendars`, `respond_to_event`, `suggest_time`.
**Status:** available, unused. Potential use: push STiDY tasks/exams to the user's real calendar;
study-block scheduling.

### 🪟 Microsoft 365 (`mcp__claude_ai_Microsoft_365__*`)
`authenticate`, `complete_authentication`. **Status:** available, needs auth flow.

### 🎵 Spotify (`mcp__claude_ai_Spotify__*`)
`search`, `create_playlist`, `add/remove_from_library`, `fetch_tracks`, `get_currently_playing`.
**Status:** available, unused. Potential use: focus/ambience playlists alongside STiDY's Focus timer.

### ✨ magic / 21st.dev (`mcp__magic__*`)
`21st_magic_component_builder`, `21st_magic_component_inspiration`, `21st_magic_component_refiner`,
`logo_search`. **Status:** available. Could accelerate UI generation, but STiDY's design is bespoke
neumorphic (see [[Design Standards]]) — prefer hand-built to match the system.

## Rejected / not installed
> [!failure] No Supabase MCP
> Erick explicitly rejected the Supabase MCP server. Wire Supabase the standard env-based way. See
> [[Coding Standards]] and [[Security]].
