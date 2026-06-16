-- ============================================================================
-- STiDY migration — 2026-06-16
-- Coworking / Collaboration Hub (R1 beta headline): live co-study rooms with
-- presence, chat, and a shared (DB-synced) focus timer.
--
-- This is STiDY's FIRST multi-user surface, so RLS is MEMBER-scoped (not the
-- usual owner-only). Membership checks go through a SECURITY DEFINER helper to
-- avoid the classic self-referential RLS recursion on the members table.
-- Idempotent: safe to run more than once.
-- ============================================================================

-- 1. ROOMS -------------------------------------------------------------------
create table if not exists public.cowork_rooms (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  -- 6-char invite code, auto-generated (pgcrypto). Unique; the secret to join private rooms.
  join_code     text not null unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  is_private    boolean not null default true,
  -- Shared focus timer (any member can drive it; clients compute remaining time)
  timer_phase   text not null default 'idle',    -- idle | focus | break
  timer_started_at timestamptz,
  timer_duration_secs int not null default 1500, -- 25 min default
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cowork_rooms_owner_idx on public.cowork_rooms (owner_id);

do $$ begin
  create trigger trg_cowork_rooms_updated before update on public.cowork_rooms
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- 2. MEMBERS -----------------------------------------------------------------
create table if not exists public.cowork_members (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.cowork_rooms (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);
create index if not exists cowork_members_room_idx on public.cowork_members (room_id);
create index if not exists cowork_members_user_idx on public.cowork_members (user_id);

-- 3. MESSAGES (author_name denormalised so we never read other users' profiles)
create table if not exists public.cowork_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.cowork_rooms (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  author_name text not null default 'Student',
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists cowork_messages_room_idx on public.cowork_messages (room_id, created_at);

-- 4. Membership helper (SECURITY DEFINER → bypasses RLS, breaks recursion) ----
create or replace function public.is_cowork_member(p_room uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.cowork_members m
    where m.room_id = p_room and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_cowork_owner(p_room uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.cowork_rooms r
    where r.id = p_room and r.owner_id = auth.uid()
  );
$$;

-- Drive the shared timer without granting members write access to room settings.
create or replace function public.set_cowork_timer(
  p_room uuid, p_phase text, p_started_at timestamptz, p_duration int
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_cowork_member(p_room) then
    raise exception 'Not a member of this room';
  end if;
  if p_phase not in ('idle', 'focus', 'break') then
    raise exception 'Invalid phase';
  end if;
  update public.cowork_rooms
     set timer_phase = p_phase,
         timer_started_at = p_started_at,
         timer_duration_secs = greatest(60, least(coalesce(p_duration, 1500), 14400))
   where id = p_room;
end;
$$;

-- Auto-add the creator as the first member.
create or replace function public.cowork_add_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.cowork_members (room_id, user_id)
  values (new.id, new.owner_id)
  on conflict (room_id, user_id) do nothing;
  return new;
end;
$$;

do $$ begin
  create trigger trg_cowork_add_owner after insert on public.cowork_rooms
    for each row execute function public.cowork_add_owner();
exception when duplicate_object then null; end $$;

-- Join by code (room_id is otherwise unreadable to non-members → code is the key).
create or replace function public.join_cowork_room(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare r_id uuid;
begin
  select id into r_id from public.cowork_rooms where join_code = upper(trim(p_code));
  if r_id is null then raise exception 'Room not found'; end if;
  insert into public.cowork_members (room_id, user_id)
  values (r_id, auth.uid())
  on conflict (room_id, user_id) do nothing;
  return r_id;
end;
$$;

-- 5. RLS — member-scoped ------------------------------------------------------
alter table public.cowork_rooms    enable row level security;
alter table public.cowork_members  enable row level security;
alter table public.cowork_messages enable row level security;

do $$ begin
  -- Rooms: members/owner can read; only the owner creates/updates/deletes the
  -- room itself. (Timer updates go through update too — see note below.)
  -- Members/owner see their rooms; everyone can discover PUBLIC rooms (to join).
  create policy "cowork_rooms_select" on public.cowork_rooms for select
    using (owner_id = auth.uid() or public.is_cowork_member(id) or is_private = false);
  create policy "cowork_rooms_insert" on public.cowork_rooms for insert
    with check (owner_id = auth.uid());
  -- Room settings are owner-only; the shared timer is driven via set_cowork_timer().
  create policy "cowork_rooms_update" on public.cowork_rooms for update
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  create policy "cowork_rooms_delete" on public.cowork_rooms for delete
    using (owner_id = auth.uid());

  -- Members: visible to fellow members; you add yourself; you (or the owner) can remove.
  create policy "cowork_members_select" on public.cowork_members for select
    using (public.is_cowork_member(room_id));
  create policy "cowork_members_insert" on public.cowork_members for insert
    with check (user_id = auth.uid());
  create policy "cowork_members_delete" on public.cowork_members for delete
    using (user_id = auth.uid() or public.is_cowork_owner(room_id));

  -- Messages: members read; you write as yourself; you delete your own.
  create policy "cowork_messages_select" on public.cowork_messages for select
    using (public.is_cowork_member(room_id));
  create policy "cowork_messages_insert" on public.cowork_messages for insert
    with check (user_id = auth.uid() and public.is_cowork_member(room_id));
  create policy "cowork_messages_delete" on public.cowork_messages for delete
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 6. Realtime — broadcast row changes to subscribed clients -------------------
do $$ begin alter publication supabase_realtime add table public.cowork_rooms;    exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.cowork_members;  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.cowork_messages; exception when duplicate_object then null; end $$;

-- ============================================================================
-- End — run in Supabase SQL editor (or `supabase db push`).
-- ============================================================================
