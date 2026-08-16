-- VibeSchool Pathways P1 foundation — safe anonymous school discovery.
-- This function deliberately exposes only active canonical schools. It does not
-- expose unmatched directory candidates, membership, ownership, contact data or
-- unverified pathway offerings.

create or replace function public.pathways_search_public_schools(
  p_query text default null,
  p_county text default null,
  p_pathway_slug text default null,
  p_combination_slug text default null,
  p_limit integer default 30
) returns table(
  school_id uuid,
  school_name text,
  county text,
  sub_county text,
  school_category text,
  ownership_type text,
  gender_type text,
  accommodation_type text,
  cluster text,
  knec_code text,
  pathway_slug text,
  pathway_name text,
  combination_slug text,
  combination_name text,
  offering_verified_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with requested_pathway as (
    select id, slug, name
    from public.pathways
    where status = 'published'
      and (p_pathway_slug is null or slug = lower(trim(p_pathway_slug)))
  ),
  requested_combination as (
    select c.id, c.slug, c.display_name, c.pathway_id
    from public.pathway_subject_combinations c
    where c.status = 'published'
      and (p_combination_slug is null or c.slug = lower(trim(p_combination_slug)))
  ),
  eligible as (
    select
      s.id as school_id,
      s.name::text as school_name,
      s.county::text as county,
      s.sub_county::text as sub_county,
      s.school_category::text as school_category,
      s.ownership_type,
      s.gender_type,
      s.accommodation_type,
      s.cluster,
      s.knec_code::text as knec_code,
      p.slug as pathway_slug,
      p.name as pathway_name,
      c.slug as combination_slug,
      c.display_name as combination_name,
      o.verified_at as offering_verified_at
    from public.schools s
    left join public.pathway_school_offerings o
      on o.school_id = s.id
     and o.offering_status = 'verified'
     and o.verified_at is not null
    left join requested_pathway p on p.id = o.pathway_id
    left join requested_combination c
      on c.id = o.combination_id
     and c.pathway_id = o.pathway_id
    where s.deleted_at is null
      and s.status = 'active'
      and (p_query is null or trim(p_query) = '' or lower(s.name) like '%' || lower(trim(p_query)) || '%')
      and (p_county is null or trim(p_county) = '' or lower(coalesce(s.county,'')) = lower(trim(p_county)))
      and (
        (p_pathway_slug is null and p_combination_slug is null)
        or (
          o.id is not null
          and (p_pathway_slug is null or p.slug = lower(trim(p_pathway_slug)))
          and (p_combination_slug is null or c.slug = lower(trim(p_combination_slug)))
        )
      )
  )
  select distinct on (e.school_id, e.pathway_slug, e.combination_slug)
    e.school_id, e.school_name, e.county, e.sub_county, e.school_category,
    e.ownership_type, e.gender_type, e.accommodation_type, e.cluster,
    e.knec_code, e.pathway_slug, e.pathway_name, e.combination_slug,
    e.combination_name, e.offering_verified_at
  from eligible e
  order by e.school_id, e.pathway_slug nulls last, e.combination_slug nulls last,
           e.offering_verified_at desc nulls last, e.school_name
  limit greatest(1, least(coalesce(p_limit,30),50));
$function$;

revoke all on function public.pathways_search_public_schools(text,text,text,text,integer) from public;
grant execute on function public.pathways_search_public_schools(text,text,text,text,integer) to anon, authenticated;

comment on function public.pathways_search_public_schools(text,text,text,text,integer) is
'Pathways public read-only school search. Returns active canonical school identity fields and only source-verified pathway/combination offerings. Never returns unmatched directory candidates or private school/account data.';
