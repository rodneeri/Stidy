---
type: reference
created: 2026-06-14
updated: 2026-06-14
tags:
  - reference
  - claude
  - ai
related:
  - "[[Tech Stack]]"
  - "[[Plugins and Skills Status]]"
---

# Claude's API Reference

Quick reference for Claude/Anthropic. For anything beyond model IDs, **invoke the `claude-api` skill**
— it's the authoritative source for pricing, params, streaming, tool use, MCP, caching, token counting,
and migration. Don't answer LLM questions from memory.

## Current model IDs
| Model | ID |
|-------|-----|
| **Opus 4.8** *(what I usually run as)* | `claude-opus-4-8` |
| Sonnet 4.6 | `claude-sonnet-4-6` |
| Haiku 4.5 | `claude-haiku-4-5-20251001` |
| Fable 5 | `claude-fable-5` |

- Knowledge cutoff: **January 2026**.
- When building AI apps, default to the latest, most capable Claude models.
- "Fast mode" in Claude Code = Opus with faster output (not a smaller model); toggle `/fast`, available
  on Opus 4.8/4.7/4.6.

## Provider strategy for STiDY
> [!important] STiDY does NOT use Claude at runtime
> Erick has no Claude API key and wants free. STiDY's AI runs on **Gemini (free)** with **Groq**
> fallback (see [[Tech Stack]]). The `lib/ai` abstraction keeps Claude as a swappable adapter
> (`@ai-sdk/anthropic` is installed) — so if he ever gets a key, it's a one-line provider switch.

## When to reach for the skill
The `claude-api` skill auto-triggers when a task names Claude/Anthropic/Fable/Opus/Sonnet/Haiku, or is
LLM-shaped (agent/MCP/tool-def/RAG/judge), or debugging refusals/cutoffs/streaming/tool-calls/tokens.
Skip it only when another provider (OpenAI/Gemini/etc.) is the subject — which, for STiDY runtime code,
it usually is.
