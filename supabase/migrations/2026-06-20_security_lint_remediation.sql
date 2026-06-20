-- ============================================================================
-- STiDY migration — 2026-06-20
-- Supabase Security Advisor / linter remediation (pre-public hardening).
--
-- Fixes the 6 lint groups flagged by Supabase (see
-- "Projects/STiDY/Security Review for Public.md" in the vault):
--   A) function_search_path_mutable
--   B) extension_in_public  (vector)
--   C) public_bucket_allows_listing  (avatars)   <- see NOTE; review before run
--   D) anon_security_definer_function_executable
--   E) authenticated_security_definer_function_executable
--   F) auth_leaked_password_protection           <- dashboard toggle, no SQL
--
-- Principle: least privilege, preserve intended behaviour. Idempotent — safe to
-- re-run. Run in the Supabase SQL editor (or `supabase db push`).
--
-- Verified against the repo on 2026-06-20:
--   * Client only calls 2 RPCs: set_cowork_timer, join_cowork_room
--     (src/features/coworking/*.tsx) -> these KEEP `authenticated` EXECUTE.
--   * is_cowork_member / is_cowork_owner are referenced inside RLS policies
--     -> they MUST keep `authenticated` EXECUTE or table reads break.
--   * The rest are trigger/internal only -> fully locked down.
--   * No column uses the `vector` type yet -> moving the extension is safe.
-- ============================================================================


-- A) function_search_path_mutable -------------------------------------------
-- Risk: a function with an inherited (mutable) search_path can be hijacked by a
-- caller who puts a malicious object earlier in their path. Fix: pin a fixed
-- search_path on every flagged function (matches the existing coworking funcs,
-- which use `set search_path = public` and are NOT flagged).
do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('set_updated_at', 'stidy_subject_grade', 'refresh_subject_grade')
  loop
    execute format('alter function public.%I(%s) set search_path = public', r.proname, r.args);
  end loop;
end $$;


-- B) extension_in_public  (vector) ------------------------------------------
-- Risk: extensions in `public` widen the attack surface and clutter the schema
-- the API exposes. Fix: move `vector` to a dedicated `extensions` schema.
-- Safe here because NO column uses the `vector` type yet (grep-verified).
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
do $$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'vector' and n.nspname = 'public'
  ) then
    alter extension vector set schema extensions;
  end if;
end $$;


-- D + E) SECURITY DEFINER functions callable by anon / authenticated --------
-- Risk: definer functions run with elevated privilege; exposing them over
-- /rest/v1/rpc/* lets clients invoke privileged logic directly. Fix: least
-- privilege per function.

-- Group 1 — trigger/internal only: revoke from ALL client roles.
-- (Trigger invocation is exempt from the EXECUTE check, so triggers keep firing.)
do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user', 'cowork_add_owner', 'rls_auto_enable')
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated',
                   r.proname, r.args);
  end loop;
end $$;

-- Group 2 — needed by authenticated users (RLS helpers + the 2 client RPCs):
-- revoke from anon + public, KEEP authenticated.
do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_cowork_member', 'is_cowork_owner',
                        'join_cowork_room', 'set_cowork_timer')
  loop
    execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to authenticated', r.proname, r.args);
  end loop;
end $$;


-- C) public_bucket_allows_listing  (avatars) --------------------------------
-- Risk: a broad public SELECT on storage.objects lets ANYONE enumerate every
-- object key in the `avatars` bucket (privacy / scraping). Fix: drop the broad
-- public-read policy and allow reads only to authenticated users; writes stay
-- owner-scoped. (Avatars remain visible to logged-in users — the only context
-- that shows them. If you ever need public/anonymous avatar display, switch to
-- 1-hour signed URLs instead of re-opening public listing.)
--
-- NOTE: storage policy NAMES vary by project. Inspect first:
--     select policyname, cmd, roles, qual, with_check
--     from pg_policies where schemaname='storage' and tablename='objects';
-- Then remove whatever broad/public SELECT policy exists for bucket 'avatars'
-- (in the Dashboard: Storage -> avatars -> Policies), and apply:

do $$
begin
  -- read: authenticated only
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects'
                   and policyname='avatars_authenticated_read') then
    create policy "avatars_authenticated_read" on storage.objects
      for select to authenticated
      using (bucket_id = 'avatars');
  end if;

  -- write: only the owner
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects'
                   and policyname='avatars_owner_write') then
    create policy "avatars_owner_write" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'avatars' and owner = auth.uid());
  end if;

  -- update: only the owner
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects'
                   and policyname='avatars_owner_modify') then
    create policy "avatars_owner_modify" on storage.objects
      for update to authenticated
      using (bucket_id = 'avatars' and owner = auth.uid());
  end if;

  -- delete: only the owner
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects'
                   and policyname='avatars_owner_delete') then
    create policy "avatars_owner_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'avatars' and owner = auth.uid());
  end if;
end $$;

-- Also flip the bucket itself to non-public so the public CDN path can't list:
update storage.buckets set public = false where id = 'avatars';


-- F) auth_leaked_password_protection ----------------------------------------
-- No SQL. Enable in Dashboard:
--   Authentication -> Providers/Policies -> Password -> turn ON
--   "Prevent the use of leaked passwords" (HaveIBeenPwned check).
--   Path may read: Authentication -> Settings -> Password security.
-- Available on the free tier. If a plan ever blocks it, enforce a strong
-- password policy (min length 8+, complexity) as a fallback.

-- ============================================================================
-- VERIFICATION
--   A: select proname, proconfig from pg_proc
--        where proname in ('set_updated_at','stidy_subject_grade','refresh_subject_grade');
--      -> proconfig shows {search_path=public}
--   B: select extname, n.nspname from pg_extension e
--        join pg_namespace n on n.oid=e.extnamespace where extname='vector';
--      -> nspname = 'extensions'
--   C: as an ANON client, list avatars -> should return nothing / denied;
--      as an AUTHENTICATED client, reading an avatar still works.
--   D/E: select p.proname,
--          has_function_privilege('anon', p.oid, 'execute') as anon,
--          has_function_privilege('authenticated', p.oid, 'execute') as auth
--        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--        where n.nspname='public'
--          and p.proname in ('handle_new_user','cowork_add_owner','rls_auto_enable',
--                            'is_cowork_member','is_cowork_owner',
--                            'join_cowork_room','set_cowork_timer');
--      -> anon=false for all; auth=false for group 1, true for group 2.
--   Re-run the Supabase Security Advisor -> A,B,C,D,E cleared; F after the toggle.
-- ============================================================================
