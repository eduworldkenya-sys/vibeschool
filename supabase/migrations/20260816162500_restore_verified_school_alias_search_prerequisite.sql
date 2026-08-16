-- Restore production School Identity alias-search prerequisites into repository history.
--
-- Production already contains these nullable evidence columns and the bounded
-- `search_verified_school_aliases(text)` helper, but the blank-database migration
-- chain did not reconstruct them. The downstream school search therefore compiled
-- in production yet failed on a clean rebuild. Restore the production contract
-- before the search privilege-hardening migration; do not expose school_aliases
-- directly to client roles.

alter table public.school_aliases
  add column if not exists source_type text,
  add column if not exists confidence numeric,
  add column if not exists verified_at timestamptz;

create or replace function public.search_verified_school_aliases(p_query text)
returns table(school_id uuid, confidence numeric)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $function$
  select
    a.school_id,
    max(coalesce(a.confidence, case when a.verified then 1 else 0 end))
  from public.school_aliases a
  where (a.verified or coalesce(a.confidence,0) >= .8)
    and (
      lower(a.alias) = lower(trim(coalesce(p_query,'')))
      or lower(a.alias) like lower(trim(coalesce(p_query,''))) || '%'
      or lower(a.alias) like '%' || lower(trim(coalesce(p_query,''))) || '%'
      or (
        regexp_replace(trim(coalesce(p_query,'')),'[^a-zA-Z0-9]+','','g') <> ''
        and a.alias_normalized like '%' || lower(regexp_replace(trim(coalesce(p_query,'')),'[^a-zA-Z0-9]+','','g')) || '%'
      )
    )
  group by a.school_id;
$function$;

revoke all on function public.search_verified_school_aliases(text) from public, anon;
grant execute on function public.search_verified_school_aliases(text) to authenticated;

comment on function public.search_verified_school_aliases(text) is
'Bounded verified/high-confidence alias lookup used by school discovery. SECURITY DEFINER keeps school_aliases private while returning only canonical school_id and confidence.';
