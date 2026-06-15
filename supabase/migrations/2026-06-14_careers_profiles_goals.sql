-- ============================================================================
-- STiDY migration — 2026-06-14
-- Career grouping (#12), profile fields (#9), external exams (EVAU/oposición),
-- flexible cross-country goals, and subject icons in the DB.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- 1. PROFILES — extra identity/preferences fields (#9) -----------------------
alter table public.profiles add column if not exists nickname    text;
alter table public.profiles add column if not exists handle      text;        -- unique public handle for co-work
alter table public.profiles add column if not exists institution text;
alter table public.profiles add column if not exists country     text;        -- ISO-ish, e.g. 'ES'
alter table public.profiles add column if not exists language     text default 'en';

-- Unique handle (case-insensitive), only when set.
create unique index if not exists profiles_handle_key
  on public.profiles (lower(handle)) where handle is not null;

-- 2. SUBJECTS — emoji icon (so server components can render it) + year/term --
alter table public.subjects add column if not exists icon text;
alter table public.subjects add column if not exists year int;   -- academic year within the career (1,2,3…)
alter table public.subjects add column if not exists term int;   -- term index within the year (1,2,3…)

-- 3. CAREERS — kind/country/term-system/start year ---------------------------
alter table public.careers add column if not exists kind        text default 'degree';      -- degree|bachillerato|oposicion|other
alter table public.careers add column if not exists country     text;
alter table public.careers add column if not exists term_system text default 'semester';    -- semester|cuatrimestre|trimestre|year
alter table public.careers add column if not exists start_year  int;
alter table public.careers add column if not exists position    int default 0;

-- 4. EXTERNAL EXAMS — official exams outside the course (EVAU, oposición…) ----
create table if not exists public.external_exams (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  career_id   uuid references public.careers (id) on delete cascade,
  name        text not null,
  score       numeric(6,3),
  max_score   numeric(6,3) not null default 10,
  weight      numeric(6,3),              -- relative weight within the external block
  exam_date   date,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists external_exams_user_idx   on public.external_exams (user_id);
create index if not exists external_exams_career_idx on public.external_exams (career_id);

-- 5. GOALS — flexible aspirations across countries & types --------------------
--    kind: admission (uni cutoff / nota de corte) | oposicion | other
create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null default 'admission',
  country      text,
  title        text not null,            -- e.g. 'Medicina', 'Cuerpo de Maestros'
  institution  text,                     -- e.g. 'UCM', region/board for oposiciones
  target_score numeric(8,3),             -- cutoff / required score
  score_scale  numeric(6,3) default 14,  -- max of the score system (ES uni = 14)
  source_url   text,
  year         int,                      -- year the cutoff/score refers to
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals (user_id);

-- 6. RLS for the new tables --------------------------------------------------
alter table public.external_exams enable row level security;
alter table public.goals          enable row level security;

drop policy if exists "external_exams_all" on public.external_exams;
create policy "external_exams_all" on public.external_exams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals_all" on public.goals;
create policy "goals_all" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- keep updated_at fresh on goals
drop trigger if exists trg_goals_updated on public.goals;
create trigger trg_goals_updated before update on public.goals
  for each row execute function public.set_updated_at();
