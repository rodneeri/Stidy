---
type: note
created: 2026-06-14
updated: 2026-06-14
tags:
  - backlog
  - features
related:
  - "[[STiDY]]"
  - "[[Short Term Ideas]]"
  - "[[Possible Features to add in the Long Term]]"
  - "[[UI Refinement]]"
---

# Features to add

Concrete, near-to-mid-term features for [[STiDY]]. Ordered roughly by readiness. Live status lives in
project memory; this is the durable backlog.

## In the current batch (requested 2026-06-14)
- [x] **Career grouping (#12)** — careers (degree/bachillerato/oposición/other), credit-weighted career
  average, year/term, external-exam panel. *Needs the user to run the migration.*
- [ ] **Mock EVAU** — dedicated timed exam mode in Study Lab: 10 questions, a **constrained AI examiner**
  (answers ≤10 clarifying questions, **never reveals answers**), countdown timer, then auto-correction
  + score. Own interface.
- [ ] **Nota de corte / Goals** — Profile "aspiring careers" → web-scan last year's cutoff → compare to
  the user's projected grade → "what your future looks like" + a simulation (input grades). Built on the
  flexible `goals` table (kind: admission | oposicion | other) so it spans **multiple countries** and
  goal types — Erick explicitly wants oposiciones and other systems, not just Spanish uni.
- [ ] **PDF-grounded AI assistant** — the assistant reads the actual PDFs stored in Resources (send to
  Gemini as file parts) and answers with grounded accuracy, citing the document.

## Also queued
- [ ] **Profile + i18n (#9)** — profile page (display_name, nickname, unique handle, institution,
  avatar via `avatars` bucket, language) + full **EN + ES** i18n (dictionaries + context).
- [ ] **Subject emoji from DB** — move icons to `subjects.icon` so the **server-rendered dashboard**
  shows them too (the one place the local store can't reach). Migration column already written.
- [ ] **Flashcard SRS review polish** — Again/Good/Easy SM-2 loop (columns exist; mostly built).
- [ ] **Grade scale on all renders** — module-level dashboard widgets still render in `%`.

See [[Possible Features to add in the Long Term]] for the ambitious horizon and [[UI Refinement]] for
visual polish work.
