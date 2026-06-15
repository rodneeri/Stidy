---
type: reference
created: 2026-06-14
updated: 2026-06-14
tags:
  - meta
  - prompts
  - working-style
related:
  - "[[Done or Used Prompts]]"
  - "[[Coding Standards]]"
  - "[[Learning Log]]"
---

# Prompt Engineering Guide

How **Erick** prompts, and how he wants me to respond. This is the most important note in the vault —
read it every session. It's about *him*, not generic prompt theory.

## How Erick prompts

- **Terse and direct.** "start working", "keep going", "claude continue", "do what i picked". Short
  messages carry full authority — a one-liner means *go*, not *ask me more*.
- **Batches huge requests.** One message can contain 6–8 distinct asks (bugs + features + polish).
  He expects me to **decompose, prioritize, and execute in order**, then report — not to pick one and
  drop the rest, and not to ask which to do first unless there's a real fork.
- **Emphasis via intensity.** "maximize the fuck out of this", "I SAID EVERYTHING". Strong language =
  *high importance / do it thoroughly*, *not* anger at me. Match the energy with thoroughness, not
  apology.
- **Visual, real-time.** He watches the work as it happens — he reads dev-server logs, screenshots
  bugs, and interrupts. He notices color strain, layout shifts, and animation jank instantly.
- **Bilingual.** English + Spanish. Spanish academic vocabulary is first-class (EVAU, bachillerato,
  cuatrimestre/trimestre, nota de corte, oposiciones).

> [!tip] The golden rule
> **When you have enough to act, act.** Erick's default expectation is autonomous execution with a
> clear report afterward. Over-asking is the #1 way to annoy him.

## When to ask vs. act

| Situation | Do this |
|-----------|---------|
| Conventional default exists | Pick it, mention it, move on |
| Fact is verifiable in code/repo | Verify it yourself, don't ask |
| Terse "keep going" after a big batch | Continue the plan autonomously |
| **Genuine fork** (e.g. which universities for nota de corte, EVAU format, storage model) | **Ask** — he answers `AskUserQuestion` thoughtfully and in detail |
| He rejected a tool call then said "keep going" | Usually a **UI/menu bug**, not disapproval — re-run or continue; only re-confirm if his answer changed the plan |

> [!warning] Accidental rejections
> Erick has rejected tool calls by accident ("the menu was bugged, do what i picked"). Don't
> over-interpret a rejection as a course-correction. If the prior intent is clear, proceed.

## How he wants output

- **Action over explanation.** Lead with what changed / what I did, not a survey of options.
- **Recommend, don't enumerate.** Give one strong recommendation with brief reasoning, not a menu of
  every possibility.
- **Status reports with structure.** Use ✅ / ⚠️, short sections, bold leads. He scans fast in a
  terminal (GitHub-flavored markdown).
- **Evidence before claims.** Never say "done/fixed/passing" without running the build/lint and
  showing it's green. He values `npx next build` ✓ as proof. See [[verification-before-completion|verify before claiming]] discipline in [[Coding Standards]].
- **Checkpoint on big batches.** After finishing a meaningful chunk, report progress + any action he
  must take (e.g. "run this SQL"), then continue or hand back.
- **Surface his to-dos clearly.** He runs SQL himself (no programmatic DDL). Always give a copy-paste
  SQL block when a feature needs schema changes.

## Cadence pattern that works

1. Acknowledge + decompose the batch into a numbered list.
2. Do the **fast, visible bugfixes first** (he's often staring at the broken thing).
3. Then the agreed feature, then the ambitious ones.
4. Build/verify after each chunk; report with ✅ and the next step.
5. Update [[Learning Log]] and project memory as I go.

## Skills & process

- He's fine with me using **superpowers** skills (brainstorming, TDD, verification) — but instructions
  WHAT he wants ≠ skip workflow. Use judgment; don't let ceremony slow obvious work.
- For open-ended "build X", brainstorm briefly, present a tight design, get a quick yes, then go. He
  approves fast ("start working") — don't belabor the design phase.

See [[Done or Used Prompts]] for concrete examples that have worked.
