-- ============================================================================
-- STiDY hotfix — 2026-06-21
-- Fix: "Create room" fails with
--   control reached end of trigger procedure without RETURN
--
-- Root cause: an earlier run installed public.cowork_add_owner() WITHOUT its
-- `return new;`. A PL/pgSQL function used by a row-level trigger MUST return a
-- row (NEW for an AFTER INSERT), or Postgres aborts the INSERT — which is the
-- INSERT behind "Create room". The repo definition is already correct; this
-- migration just re-applies it so the LIVE database matches.
--
-- Idempotent: safe to run any number of times. Run in the Supabase SQL editor
-- (or `supabase db push`).
-- ============================================================================

-- Re-create the trigger function WITH its return, overwriting any stale version.
create or replace function public.cowork_add_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.cowork_members (room_id, user_id)
  values (new.id, new.owner_id)
  on conflict (room_id, user_id) do nothing;
  return new;   -- <- the line that was missing in the live DB
end;
$$;

-- Make sure the trigger that calls it actually exists (no-op if already there).
do $$ begin
  create trigger trg_cowork_add_owner after insert on public.cowork_rooms
    for each row execute function public.cowork_add_owner();
exception when duplicate_object then null; end $$;

-- Defensive: the shared updated_at helper is also a trigger function; re-apply
-- it with its return too, in case the same bad run touched it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- VERIFY: this should return a row and 'OK' (and auto-add you as a member):
--   insert into public.cowork_rooms (owner_id, name)
--   values (auth.uid(), 'trigger smoke test') returning id, 'OK' as status;
-- (delete it afterwards if you like.)
-- ============================================================================
