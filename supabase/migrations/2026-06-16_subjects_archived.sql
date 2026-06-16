-- ============================================================================
-- STiDY migration — 2026-06-16
-- Subjects: an `archived` flag so "mark term done" archives (never deletes)
-- every subject in that career/year/term. Idempotent.
-- ============================================================================
alter table public.subjects add column if not exists archived boolean not null default false;
create index if not exists subjects_archived_idx on public.subjects (user_id, archived);
