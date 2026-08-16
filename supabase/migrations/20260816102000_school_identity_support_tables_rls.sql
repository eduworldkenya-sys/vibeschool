-- School identity support-table RLS hardening.
-- These tables participate in school identity/search support but are not intended
-- to be directly writable from browser roles.
--
-- IMPORTANT: school_directory_public is a security_invoker view and
-- search_school_directory() is SECURITY INVOKER. They therefore need authenticated
-- SELECT on school_levels and school_aliases. RLS must remove browser mutation
-- authority without accidentally breaking the supported search surface.

alter table public.school_levels enable row level security;
alter table public.school_aliases enable row level security;
alter table public.school_directory_sources enable row level security;

-- Remove all inherited browser authority first, then add only the exact read
-- privileges required by the approved school-directory/search surface.
revoke all on table public.school_levels from anon, authenticated;
revoke all on table public.school_aliases from anon, authenticated;
revoke all on table public.school_directory_sources from anon, authenticated;

grant select on table public.school_levels to authenticated;
grant select on table public.school_aliases to authenticated;

-- Read-only RLS policies. No INSERT/UPDATE/DELETE policies exist for browser roles.
drop policy if exists school_levels_authenticated_read on public.school_levels;
create policy school_levels_authenticated_read
  on public.school_levels
  for select
  to authenticated
  using (true);

drop policy if exists school_aliases_authenticated_read on public.school_aliases;
create policy school_aliases_authenticated_read
  on public.school_aliases
  for select
  to authenticated
  using (true);

-- Legacy provenance is not part of the browser search contract. Keep it fully
-- closed to anon/authenticated; service-role/owner maintenance remains privileged.

comment on table public.school_levels is
  'School level support table. Authenticated users have read-only access required by the security-invoker school directory view; browser mutation is denied by RLS and grants.';
comment on table public.school_aliases is
  'School identity alias support table. Authenticated users have read-only access required by search_school_directory(); browser mutation is denied by RLS and grants.';
comment on table public.school_directory_sources is
  'Legacy school provenance support table. Direct browser access is denied; authoritative evidence uses the newer observation/reconciliation pipeline.';
