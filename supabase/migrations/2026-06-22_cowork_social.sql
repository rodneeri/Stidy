-- ============================================================================
-- STiDY migration -- 2026-06-22
-- Cowork social foundation: presence/status + a friends graph + a SAFE public
-- profile reader. Builds on the existing public.profiles (full_name, nickname,
-- avatar_url, handle). This is the DB layer the cowork overhaul needs for:
--   - profile customization + account-dropdown user section
--   - friends + status
--   - showing real identities (avatar/name/status) in cowork rooms
--
-- Philosophy matches 2026-06-16_coworking.sql: cross-user reads go through
-- SECURITY DEFINER helpers so profiles RLS stays tight; writes go through RPCs.
-- Uniquely-named dollar tags ($fn$/$do$) + ASCII-only. Idempotent.
-- ============================================================================

-- 1. PRESENCE on profiles -----------------------------------------------------
alter table public.profiles add column if not exists status     text not null default 'offline';
alter table public.profiles add column if not exists last_seen  timestamptz;

-- Constrain status to the known set (added defensively; ignore if already there).
do $do$ begin
  alter table public.profiles
    add constraint profiles_status_chk
    check (status in ('offline','online','studying','break','away'));
exception when duplicate_object then null; end $do$;

-- 2. SAFE PUBLIC PROFILE READER ----------------------------------------------
-- Returns the handful of public fields for a set of users (member lists,
-- friend lists, search results) WITHOUT opening up the profiles table via RLS.
create or replace function public.get_profiles(p_ids uuid[])
returns table (id uuid, name text, handle text, avatar_url text, status text)
language sql security definer set search_path = public stable
as $fn$
  select p.id,
         coalesce(nullif(trim(p.nickname), ''), nullif(trim(p.full_name), ''), 'Student') as name,
         p.handle,
         p.avatar_url,
         p.status
    from public.profiles p
   where p.id = any(p_ids);
$fn$;

-- Find someone by their public handle (case-insensitive) -- for "add friend".
create or replace function public.find_profile_by_handle(p_handle text)
returns table (id uuid, name text, handle text, avatar_url text, status text)
language sql security definer set search_path = public stable
as $fn$
  select p.id,
         coalesce(nullif(trim(p.nickname), ''), nullif(trim(p.full_name), ''), 'Student') as name,
         p.handle,
         p.avatar_url,
         p.status
    from public.profiles p
   where lower(p.handle) = lower(trim(p_handle))
   limit 1;
$fn$;

-- Set my own presence (validates the enum, stamps last_seen).
create or replace function public.set_my_status(p_status text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if p_status not in ('offline','online','studying','break','away') then
    raise exception 'Invalid status';
  end if;
  update public.profiles
     set status = p_status, last_seen = now()
   where id = auth.uid();
end;
$fn$;

-- 3. FRIENDSHIPS --------------------------------------------------------------
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint friendships_status_chk check (status in ('pending','accepted')),
  constraint friendships_no_self    check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

do $do$ begin
  create trigger trg_friendships_updated before update on public.friendships
    for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $do$;

-- Send a request by handle. Handles self, missing user, existing/reverse
-- requests (auto-accepts if they already invited you), and duplicates.
create or replace function public.send_friend_request(p_handle text)
returns text
language plpgsql security definer set search_path = public
as $fn$
declare
  v_target uuid;
  v_existing record;
begin
  select id into v_target from public.profiles
   where lower(handle) = lower(trim(p_handle)) limit 1;
  if v_target is null then raise exception 'No user with that handle'; end if;
  if v_target = auth.uid() then raise exception 'You cannot add yourself'; end if;

  select * into v_existing from public.friendships
   where (requester_id = auth.uid() and addressee_id = v_target)
      or (requester_id = v_target and addressee_id = auth.uid())
   limit 1;

  if found then
    if v_existing.status = 'accepted' then
      return 'already_friends';
    end if;
    if v_existing.addressee_id = auth.uid() then
      update public.friendships set status = 'accepted' where id = v_existing.id;
      return 'accepted';
    end if;
    return 'pending';
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (auth.uid(), v_target);
  return 'sent';
end;
$fn$;

-- Accept or decline a request addressed to me.
create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if p_accept then
    update public.friendships set status = 'accepted'
     where id = p_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships
     where id = p_id and addressee_id = auth.uid() and status = 'pending';
  end if;
end;
$fn$;

-- Remove a friend / cancel a request (either side).
create or replace function public.remove_friend(p_other uuid)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  delete from public.friendships
   where (requester_id = auth.uid() and addressee_id = p_other)
      or (requester_id = p_other and addressee_id = auth.uid());
end;
$fn$;

-- My friends + incoming/outgoing requests in one call, with public profile data.
-- direction: 'friend' | 'incoming' | 'outgoing'
create or replace function public.list_friends()
returns table (
  friendship_id uuid,
  user_id       uuid,
  name          text,
  handle        text,
  avatar_url    text,
  status        text,
  direction     text
)
language sql security definer set search_path = public stable
as $fn$
  select f.id,
         other.id,
         coalesce(nullif(trim(other.nickname), ''), nullif(trim(other.full_name), ''), 'Student'),
         other.handle,
         other.avatar_url,
         other.status,
         case
           when f.status = 'accepted' then 'friend'
           when f.addressee_id = auth.uid() then 'incoming'
           else 'outgoing'
         end as direction
    from public.friendships f
    join public.profiles other
      on other.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
   where f.requester_id = auth.uid() or f.addressee_id = auth.uid()
   order by (f.status = 'pending') desc, other.nickname nulls last;
$fn$;

-- 4. RLS ----------------------------------------------------------------------
alter table public.friendships enable row level security;

do $do$ begin
  create policy "friendships_select" on public.friendships for select
    using (requester_id = auth.uid() or addressee_id = auth.uid());
exception when duplicate_object then null; end $do$;

-- 5. Realtime -----------------------------------------------------------------
do $do$ begin alter publication supabase_realtime add table public.friendships; exception when duplicate_object then null; end $do$;
