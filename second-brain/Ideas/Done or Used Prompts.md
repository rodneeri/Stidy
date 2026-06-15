---
type: note
created: 2026-06-14
updated: 2026-06-14
tags:
  - prompts
  - patterns
related:
  - "[[Prompt Engineering Guide]]"
---

# Done or Used Prompts

A catalog of prompts Erick has actually used and how I should read them. Pattern-library, not a
transcript. Pair with [[Prompt Engineering Guide]].

## Real examples and their meaning
| What he typed | What it means |
|---------------|---------------|
| "Can you continue improving and building Stidy" | Open mandate. Load context, pick the highest-value work, brainstorm briefly, then build. |
| "start working" / "claude continue" / "keep going" | Approval to proceed autonomously. **Do not re-ask.** Continue the plan. |
| "do what i picked" / "the menu was bugged" | A tool rejection was accidental. Honor his selection; proceed. |
| "maximize the fuck out of this" | Go all-in. Be thorough and ambitious, not minimal. |
| "I SAID EVERYTHING" *(past session)* | He asked for comprehensive coverage; don't cherry-pick a subset. |
| Big multi-item message (bugs + features + polish) | Decompose into a numbered list, do fast fixes first, then features; report with ✅. |
| Screenshot + "it happens in more places" | A systemic bug — find the root cause and fix it everywhere, not just the one screen. |

## Reusable templates (for me, when proposing options)
- **Decompose a batch:** "Here's how I'm reading your list: 1… 2… 3… I'll do the fast fixes first,
  then the agreed feature, then the ambitious ones."
- **Checkpoint:** "✅ N of M done, build green. ⚠️ One action for you: run this SQL. Continuing with X."
- **Genuine fork only:** present 2–4 crisp options via `AskUserQuestion`, lead with a recommendation.

## Effective patterns observed
- He responds well to **previews** in option cards (ASCII mockups of the feature) — used for the big-
  feature priority question and he engaged with them.
- He likes **copy-paste SQL blocks** delivered inline when a feature needs schema.
- He likes **honest scope calls** ("I deliberately did NOT stagger Resources because its fly-animation
  measures rects") — explain trade-offs, don't hide them.

> [!tip] Anti-patterns to avoid
> Surveying every option instead of recommending; asking about conventional defaults; claiming "done"
> without a green build; doing one item from a batch and forgetting the rest.
