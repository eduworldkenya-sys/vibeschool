-- Safe, optional school labels for the public Success Wishes card composer.
-- Search the existing national directory; never use these rows as identity or enrollment authority.
create or replace function public.success_wishes_school_search_public_v1(
  p_query text,
  p_limit integer default 12
)
returns table (
  directory_id uuid,
  school_name text,
  county text,
  sub_county text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d.id as directory_id,
    d.name as school_name,
    nullif(btrim(d.county), '') as county,
    nullif(btrim(d.sub_county), '') as sub_county
  from public.schools_directory d
  where length(btrim(coalesce(p_query, ''))) >= 2
    and d.name ilike '%' || btrim(p_query) || '%'
  order by
    case when lower(d.name) = lower(btrim(p_query)) then 0 else 1 end,
    d.name asc
  limit least(greatest(coalesce(p_limit, 12), 1), 12);
$$;

revoke all on function public.success_wishes_school_search_public_v1(text, integer) from public;
grant execute on function public.success_wishes_school_search_public_v1(text, integer) to anon, authenticated;

comment on function public.success_wishes_school_search_public_v1(text, integer)
is 'Read-only safe school label search for optional Success Wishes context. Directory results are not identity, enrollment, permission, approval, or delivery authority.';
