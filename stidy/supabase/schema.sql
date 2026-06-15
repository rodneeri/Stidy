-- ============================================================================
--  STiDY — Premium Academic Operating System
--  Supabase / PostgreSQL schema  •  v1.0
--
--  Conventions
--    - Every user-owned table carries `user_id uuid` -> auth.users(id).
--    - RLS is ENABLED on every table; the default deny + per-row owner policy.
--    - `updated_at` is maintained by a shared trigger.
--    - The Grade Intelligence Engine uses JSONB-defined dynamic weights so a
--      grading scheme can be reshaped at runtime without migrations.
--
--  Apply with:  supabase db reset   (or paste into the SQL editor)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "vector";         -- embeddings for RAG / knowledge graph (optional)

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
create type resource_kind   as enum ('theory', 'practice', 'exam', 'admin', 'other');
create type resource_source as enum ('upload', 'link');
create type task_status     as enum ('todo', 'in_progress', 'done', 'archived');
create type task_priority   as enum ('low', 'medium', 'high', 'urgent');
create type theme_preset    as enum ('nexus', 'paper', 'cyber', 'nature', 'soft', 'soft-dark', 'metal');

-- ----------------------------------------------------------------------------
-- 2. Shared helpers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 3. PROFILES  (1:1 with auth.users)
-- ============================================================================
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  -- UI / theme engine state
  theme       theme_preset not null default 'nexus',
  accent_primary   text default '#7C5CFF',   -- CSS var override
  accent_secondary text default '#22D3EE',
  settings    jsonb not null default '{}'::jsonb,  -- ambience, sounds, reduced-motion…
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-provision a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. CAREERS  (a user's degree / programme)
-- ============================================================================
create table public.careers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  institution text,
  color       text default '#7C5CFF',
  icon        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index careers_user_idx on public.careers (user_id);
create trigger trg_careers_updated before update on public.careers
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 5. SUBJECTS  (Career > Subject > Semester > Module > Topic via self-nest)
-- ============================================================================
create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  career_id    uuid references public.careers (id) on delete set null,
  parent_id    uuid references public.subjects (id) on delete cascade, -- modules/topics nest here
  name         text not null,
  code         text,
  professor    text,
  professor_email text,
  semester     text,
  credits      numeric(4,1),
  color        text default '#7C5CFF',
  -- Denormalised, trigger-maintained cache of the weighted average (0–100, null if no grades)
  current_grade numeric(6,3),
  position     int default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index subjects_user_idx   on public.subjects (user_id);
create index subjects_career_idx on public.subjects (career_id);
create index subjects_parent_idx on public.subjects (parent_id);
create trigger trg_subjects_updated before update on public.subjects
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 6. GRADING STRUCTURES  (the dynamic-weight core)
--    `categories` JSONB shape:
--      [{ "id": "uuid", "name": "Midterm", "weight": 30, "drop_lowest": 0 }, …]
--    Weights are normalised at calc time, so manual overrides need not sum to 100.
-- ============================================================================
create table public.grading_structures (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  categories  jsonb not null default '[]'::jsonb,
  pass_mark   numeric(5,2) default 50,      -- threshold for "passing"
  target_grade numeric(5,2) default 90,     -- used by the Target Solver
  source      text default 'manual',        -- 'manual' | 'ai_syllabus'
  ai_confidence numeric(4,3),               -- parser confidence 0–1
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (subject_id)
);
create index grading_user_idx on public.grading_structures (user_id);
create trigger trg_grading_updated before update on public.grading_structures
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 7. GRADES  (individual scored items, bound to a category id within the JSONB)
-- ============================================================================
create table public.grades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  subject_id   uuid not null references public.subjects (id) on delete cascade,
  category_id  text not null,               -- matches a categories[].id in grading_structures
  title        text not null,
  score        numeric(7,3),                -- raw points obtained (null = ungraded/planned)
  max_score    numeric(7,3) not null default 100,
  weight       numeric(6,3),                -- optional weight of this item within its category
  is_projected boolean not null default false,  -- "What-If" scenario rows
  graded_at    date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index grades_user_idx     on public.grades (user_id);
create index grades_subject_idx  on public.grades (subject_id);
create index grades_category_idx on public.grades (subject_id, category_id);
create trigger trg_grades_updated before update on public.grades
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7a. Weighted-average engine
--     Returns the current weighted grade (0–100) for a subject.
--     - Each category's items are averaged as a percentage (score/max*100).
--     - `drop_lowest` discards the N weakest items per category.
--     - Categories with no real grades are excluded and weights re-normalised,
--       so "current grade" reflects only what's been completed.
--     - p_include_projected folds in is_projected rows for "What-If".
-- ----------------------------------------------------------------------------
create or replace function public.stidy_subject_grade(
  p_subject_id uuid,
  p_include_projected boolean default false
)
returns numeric
language plpgsql
stable
as $$
declare
  cat            jsonb;
  v_categories   jsonb;
  v_weight       numeric;
  v_drop         int;
  v_cat_avg      numeric;
  v_weighted_sum numeric := 0;
  v_weight_sum   numeric := 0;
begin
  select categories into v_categories
  from public.grading_structures
  where subject_id = p_subject_id;

  if v_categories is null then
    return null;
  end if;

  for cat in select * from jsonb_array_elements(v_categories)
  loop
    v_weight := coalesce((cat ->> 'weight')::numeric, 0);
    v_drop   := coalesce((cat ->> 'drop_lowest')::int, 0);

    -- Weighted average of the (optionally trimmed) graded items for this category.
    -- Items carry an optional in-category `weight` (default 1 = equal weighting).
    with pct as (
      select (g.score / nullif(g.max_score, 0)) * 100 as p,
             coalesce(g.weight, 1) as w
      from public.grades g
      where g.subject_id = p_subject_id
        and g.category_id = (cat ->> 'id')
        and g.score is not null
        and (p_include_projected or g.is_projected = false)
      order by p asc
      offset v_drop
    )
    select case when sum(w) > 0 then sum(p * w) / sum(w) end into v_cat_avg from pct;

    if v_cat_avg is not null and v_weight > 0 then
      v_weighted_sum := v_weighted_sum + v_cat_avg * v_weight;
      v_weight_sum   := v_weight_sum + v_weight;
    end if;
  end loop;

  if v_weight_sum = 0 then
    return null;                       -- nothing graded yet
  end if;

  return round(v_weighted_sum / v_weight_sum, 3);
end;
$$;

-- Keep subjects.current_grade in sync whenever grades change.
create or replace function public.refresh_subject_grade()
returns trigger
language plpgsql
as $$
declare
  v_subject uuid := coalesce(new.subject_id, old.subject_id);
begin
  update public.subjects
     set current_grade = public.stidy_subject_grade(v_subject, false)
   where id = v_subject;
  return coalesce(new, old);
end;
$$;

create trigger trg_grades_refresh
  after insert or update or delete on public.grades
  for each row execute function public.refresh_subject_grade();

-- Recompute when the weighting scheme itself changes.
create trigger trg_grading_refresh
  after insert or update on public.grading_structures
  for each row execute function public.refresh_subject_grade();

-- ============================================================================
-- 8. RESOURCES  (Resource Vault)
-- ============================================================================
create table public.resources (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  subject_id   uuid references public.subjects (id) on delete cascade,
  title        text not null,
  kind         resource_kind   not null default 'other',
  source       resource_source not null default 'upload',
  storage_path text,            -- path in the Supabase Storage bucket
  url          text,            -- for source = 'link'
  mime_type    text,
  size_bytes   bigint,
  meta         jsonb not null default '{}'::jsonb,  -- annotations, page count…
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index resources_user_idx    on public.resources (user_id);
create index resources_subject_idx on public.resources (subject_id);
create trigger trg_resources_updated before update on public.resources
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 9. TASKS  (todos / due dates / timetable-aware)
-- ============================================================================
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subject_id  uuid references public.subjects (id) on delete set null,
  title       text not null,
  notes       text,
  status      task_status   not null default 'todo',
  priority    task_priority not null default 'medium',
  due_at      timestamptz,
  is_exam     boolean not null default false,   -- powers conflict detection
  category    text default 'task',              -- task|homework|exam|quiz|event|class|lab|project|reading|deadline
  location    text,                              -- room / Zoom / Teams link
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tasks_user_idx    on public.tasks (user_id);
create index tasks_due_idx     on public.tasks (user_id, due_at);
create index tasks_subject_idx on public.tasks (subject_id);
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 10. FLASHCARDS  (SRS — SM-2 style scheduling fields)
-- ============================================================================
create table public.flashcards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  subject_id    uuid references public.subjects (id) on delete set null,
  front         text not null,
  back          text not null,
  ease_factor   numeric(4,2) not null default 2.5,   -- SM-2 EF
  interval_days int not null default 0,
  repetitions   int not null default 0,
  due_date      date not null default current_date,  -- next_review_date
  source        text default 'manual',               -- 'manual' | 'ai_generated'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index flashcards_user_idx on public.flashcards (user_id);
create index flashcards_due_idx  on public.flashcards (user_id, due_date);
create trigger trg_flashcards_updated before update on public.flashcards
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 11. STUDY LOGS  (Deep Work Timer / Burnout Monitor source data)
-- ============================================================================
create table public.study_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subject_id  uuid references public.subjects (id) on delete set null,
  started_at  timestamptz not null default now(),
  duration_seconds int not null default 0,
  kind        text default 'focus',   -- 'focus' | 'break'
  created_at  timestamptz not null default now()
);
create index study_logs_user_idx    on public.study_logs (user_id);
create index study_logs_subject_idx on public.study_logs (subject_id);
create index study_logs_time_idx    on public.study_logs (user_id, started_at);

-- ============================================================================
-- 12. ROW LEVEL SECURITY
--     Default-deny: enable RLS, then grant owners full CRUD over their rows.
-- ============================================================================
alter table public.profiles           enable row level security;
alter table public.careers            enable row level security;
alter table public.subjects           enable row level security;
alter table public.grading_structures enable row level security;
alter table public.grades             enable row level security;
alter table public.resources          enable row level security;
alter table public.tasks              enable row level security;
alter table public.flashcards         enable row level security;
alter table public.study_logs         enable row level security;

-- profiles: keyed on id (== auth.uid())
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
-- (insert handled by handle_new_user trigger; no delete — cascade from auth.users)

-- Generic owner policy for every user_id-scoped table.
do $$
declare t text;
begin
  foreach t in array array[
    'careers','subjects','grading_structures','grades',
    'resources','tasks','flashcards','study_logs'
  ]
  loop
    execute format($f$
      create policy "%1$s_select" on public.%1$s for select using (auth.uid() = user_id);
      create policy "%1$s_insert" on public.%1$s for insert with check (auth.uid() = user_id);
      create policy "%1$s_update" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
      create policy "%1$s_delete" on public.%1$s for delete using (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- ============================================================================
-- 13. STORAGE  (Resource Vault bucket + owner-scoped policies)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

create policy "resources_read"   on storage.objects for select
  using (bucket_id = 'resources' and owner = auth.uid());
create policy "resources_write"  on storage.objects for insert
  with check (bucket_id = 'resources' and owner = auth.uid());
create policy "resources_modify" on storage.objects for update
  using (bucket_id = 'resources' and owner = auth.uid());
create policy "resources_remove" on storage.objects for delete
  using (bucket_id = 'resources' and owner = auth.uid());

-- ============================================================================
--  End of schema
-- ============================================================================
