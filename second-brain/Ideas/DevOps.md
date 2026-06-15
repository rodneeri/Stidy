---
type: note
created: 2026-06-14
updated: 2026-06-14
tags:
  - devops
  - workflow
related:
  - "[[Tech Stack]]"
  - "[[Coding Standards]]"
  - "[[Security]]"
---

# DevOps

Operational workflow for [[STiDY]] on Erick's machine (Windows 11, PowerShell + Bash tool).

## Local dev loop
```bash
# from stidy/
npx next dev        # run in background; logs → /tmp/stidy-dev.log
npx next build      # full type-check + route list, after each chunk
npx eslint <paths>  # lint changed files
```
- Verify routes serve: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login` → **200**;
  `/` → **307** (auth guard redirect when no session). Authed pages 307 to `/login` under `curl`
  (no session) — that's expected; Erick's browser sees the real page.
- Restart the dev server after big changes (kill the `next dev` node process, relaunch).

## Environment
- Env vars in `stidy/.env.local` (Next 16 reads it automatically). See [[Tech Stack]] for the list.
- DB checks: `node --env-file=.env.local scripts/<check>.mjs` with the service-role key. Dev scripts
  live in `stidy/scripts/`. **Don't run live AI scripts** — they burn Gemini free-tier quota.

## Database migrations
- Erick applies SQL **manually** in the Supabase SQL Editor (no programmatic DDL; Supabase MCP rejected).
- Write **idempotent** migrations to `supabase/migrations/` and hand him a copy-paste block.
- Feature must degrade gracefully until applied (feature-detect + retry stripping new columns).

## Deploy
- Target: **Vercel free tier**. Supabase project ref `obqwiewwkylyrhsrmmob`.

## Source control
> [!todo] Not a git repo yet
> The workspace root (`Claude Projects/`) is **not** under git. Worth `git init` for the `stidy/`
> app to get history + enable `/code-review ultra`. Offer it; don't assume.

## Gotchas
- Windows paths; PowerShell is primary but a Bash tool (Git Bash / POSIX) is available — pick syntax
  per tool. `/tmp` works under the Bash tool.
- App lives in `stidy/`, a subfolder — keep it separate from the unrelated `files/` dir and this
  `second-brain/` vault.
