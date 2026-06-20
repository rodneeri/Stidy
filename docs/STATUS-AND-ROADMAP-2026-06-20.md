# STiDY — Overnight Status & Roadmap (2026-06-20)

Autonomous overnight session. Branches only — **nothing pushed to `main`**. Review each
branch in the morning and merge what you like.

## Branches created tonight
| Branch | Worktree dir | Contents |
|---|---|---|
| `claude/cert-2026-06-20` | (main checkout) | Trusted local HTTPS (cert fix) + this doc |
| `claude/landing-2026-06-20` | `../stidy-landing` | Landing page redesign (agent) |
| `claude/uifixes-2026-06-20` | `../stidy-uifixes` | Build/lint health + timetable/resources/flashcards density (agent) |

To review: `git log claude/<branch>`, or open the worktree dir. To merge: `git checkout main && git merge claude/<branch>`.
Clean up worktrees when done: `git worktree remove ../stidy-landing` etc.

---

## ✅ Done tonight
- **Certificate / "Not secure" fix** — `npm run dev:https` now serves trusted HTTPS on
  `https://localhost:3000` via mkcert (local CA installed in the OS trust store; you clicked
  the trust dialog). Green padlock, no warning. Plain `npm run dev` (HTTP) unchanged. See
  `docs/LOCAL_HTTPS.md`. Certs live in git-ignored `certificates/`.
- **(Environment, not this repo)** Installed the `headroom-ai` tooling Erick asked about, and
  repaired the Obsidian vault's stale operating files + dark auto-memory. Details in the vault.

## 🟡 In progress (agents, this session)
- **Landing page redesign** (`claude/landing-2026-06-20`) — your big ask: kill the boring
  EvAU-laden layout; fluid scroll-driven animations (equiduct-style motion, NOT its UI;
  keep our theme), tabbed sections, FAQ, and an easily-updatable "Under Development" roadmap
  section. The real landing UI is `src/features/marketing/Landing.tsx` (page.tsx just renders it).
- **In-app density + build health** (`claude/uifixes-2026-06-20`) — green `build`/`lint`;
  timetable entries made compact + filterable (subject/career/type); resources list polish +
  filters; flashcard **sets** organized into a grid with editable name, times-completed, avg
  score, #questions, difficulty.

## 🔴 Needs YOU (cannot be done from code)
- **Cowork chat real fix** — the "only 1 user can type / messages don't appear" symptom is almost
  certainly the Supabase realtime migration not being fully applied. Run the contents of
  `supabase/migrations/*coworking*.sql` in the Supabase SQL editor and confirm the `cowork_*`
  tables are in the `supabase_realtime` publication. The client code is correct.
- **Admin account** — code grants admin to `erkgraff@gmail.com` via `isAdminEmail()`. Confirm that's
  the email you want (your note said `erkgraff@gmail.com`; your Claude login is `erickr01@ucm.es`).

## 📋 Feature backlog (from your Issues note, prioritized)
**High (UX-blocking / requested):**
1. **Landing redesign** — in progress tonight (see above).
2. **Per-subject hub** — clicking a subject opens a Google-Classroom-style hub (Resources / Study
   Lab / Focus / Timetable / Grades scoped to that subject); rest of the app unchanged. Designed to
   scale past ~5 subjects without flooding the screen.
3. **Timetable & Resources density + filters** — in progress tonight.
4. **Flashcard sets grid with stats** — in progress tonight.

**Medium (engagement / scale):**
5. **Onboarding / first-run tour** — skippable, dynamic walkthrough on first login; candidate
   **mascot** (a 🦆 duck was floated) that guides the tour and could become the AI assistant's face.
6. **Breathing-color section headers** — already shipped (calm 9s drift); verify coverage on
   Command Center, Grade Engine, Focus, Resources, Study Lab, Grades, Timetable, Settings, Cowork.
7. **Cowork overhaul** — whiteboard; file open/edit that surfaces into Resources; persistence across
   tab switches; cowork timetable; friends/status/invites; join via link or in-app invite (not just
   code); **live lobby list** (no reload when a new public room appears); public-lobby organization.
8. **Profile dropdown expansion** — now that users/connections exist, add friends/status/account.

**Lower / polish:**
9. Remove/repurpose the redundant command button (search bar already covers it) — partly done.
10. Subject management: hide professor/course-code when empty (shipped — verify).
11. Replace EvAU content on the landing (handled in redesign).

## 🐞 Known bugs — triage
| Bug | Status |
|---|---|
| Exam-gen `Unexpected token 'A'… not valid JSON` | Fixed 2026-06-17 (response-ok check + global Error Center popup) |
| Theme resets on logo click / reload | Fixed 2026-06-17 — verify on your machine |
| Two STiDY logos on landing | Fixed (commit 3ccf6c6) |
| "No details" under subjects when empty | Fixed (a93390f) — verify |
| Flashcard GPU crash `STATUS_ACCESS_VIOLATION` | Mitigated (removed backdrop-blur behind 3D flip) — **needs confirmation on your GPU** |
| Cowork chat (1 user / no broadcast) | Code OK; **needs Supabase migration** (see above) |
| CI red (npm ci) | Fixed 2026-06-17 (regenerated lockfile, Node matrix) — agent re-verifies build tonight |

## Next session candidates
Per-subject hub (#2) and the cowork overhaul (#7) are the two largest remaining bets and were
previously left as specs awaiting your review. Onboarding+mascot (#5) is high-engagement, medium effort.
