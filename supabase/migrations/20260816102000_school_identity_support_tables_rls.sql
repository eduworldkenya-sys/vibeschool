-- School identity support-table RLS hardening.
-- These tables participate in school identity/search support but are not intended
-- to be directly writable from browser roles. Existing RPC/view surfaces remain
-- the supported access path.

alter table public.school_levels enable row level security;
alter table public.school_aliases enable row level security;
alter table public.school_directory_sources enable row level security;

-- Fail closed for direct client access. Service-role and SECURITY DEFINER
-- maintenance paths retain their privileged access; no anon/authenticated policy
-- is intentionally added here.
revoke all on table public.school_levels from anon, authenticated;
revoke all on table public.school_aliases from anon, authenticated;
revoke all on table public.school_directory_sources from anon, authenticated;

comment on table public.school_levels is
  'School identity support table. Direct browser access is denied; consume through approved school directory/search surfaces.';
comment on table public.school_aliases is
  'School identity alias support table. Direct browser access is denied; alias matching is mediated by approved directory/search functions.';
comment on table public.school_directory_sources is
  'Legacy school provenance support table. Direct browser access is denied; authoritative evidence uses the newer observation/reconciliation pipeline.';
