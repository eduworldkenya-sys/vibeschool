-- Additive Pathways public-school evidence API.
-- Keeps the existing search RPC intact while exposing provenance needed by the trust-first UI.

create or replace function public.pathways_search_public_schools_v2(
  p_query text default null,
  p_county text default null,
  p_pathway_slug text default null,
  p_combination_slug text default null,
  p_limit integer default 30
)
returns table(
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
  verified_at timestamptz,
  source_authority text,
  source_name text,
  source_url text,
  source_reference text,
  source_observed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.name::text,
    s.county::text,
    s.sub_county::text,
    s.school_category::text,
    s.ownership_type,
    s.gender_type,
    s.accommodation_type,
    s.cluster,
    s.knec_code::text,
    p.slug,
    p.name,
    c.slug,
    c.display_name,
    o.verified_at,
    src.authority_name,
    src.source_name,
    src.source_url,
    src.source_reference,
    src.observed_at
  from public.schools s
  left join public.pathway_school_offerings o
    on o.school_id = s.id
   and o.verification_state = 'verified'
   and o.verified_at is not null
   and (o.effective_to is null or o.effective_to >= current_date)
  left join public.pathway_sources src
    on src.id = o.source_id
   and src.is_public = true
   and src.status = 'active'
  left join public.pathways p
    on p.id = o.pathway_id
   and src.id is not null
   and p.status = 'published'
   and p.verification_state = 'verified'
  left join public.pathway_subject_combinations c
    on c.id = o.combination_id
   and p.id is not null
   and c.status = 'published'
   and c.verification_state = 'verified'
  where s.deleted_at is null
    and s.status = 'active'
    and (
      p_query is null or trim(p_query) = ''
      or lower(s.name) like '%' || lower(trim(p_query)) || '%'
    )
    and (
      p_county is null or trim(p_county) = ''
      or lower(coalesce(s.county, '')) = lower(trim(p_county))
    )
    and (
      p_pathway_slug is null or trim(p_pathway_slug) = ''
      or p.slug = lower(trim(p_pathway_slug))
    )
    and (
      p_combination_slug is null or trim(p_combination_slug) = ''
      or c.slug = lower(trim(p_combination_slug))
    )
  order by
    case when p_query is not null and lower(s.name) = lower(trim(p_query)) then 0 else 1 end,
    s.name asc,
    p.name asc nulls last,
    c.display_name asc nulls last
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

revoke all on function public.pathways_search_public_schools_v2(text,text,text,text,integer) from public;
grant execute on function public.pathways_search_public_schools_v2(text,text,text,text,integer) to anon, authenticated;

comment on function public.pathways_search_public_schools_v2(text,text,text,text,integer) is
  'Public canonical-school search. Pathway offerings and provenance are returned only for current verified claims backed by an active public source.';
