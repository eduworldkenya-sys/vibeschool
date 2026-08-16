-- School Identity P0 coverage control plane.
--
-- Directory rows are a discovery universe, never an authoritative denominator.
-- This owner-only projection keeps discovery, canonical identity and Tier-0
-- authoritative evidence as separate measures so operators can see where coverage
-- is weak without accidentally promoting raw directory volume into government truth.
-- Administrative geography is fail-closed: missing county remains UNKNOWN; region
-- must never be silently substituted for county.

create or replace function public.hq_school_identity_coverage_by_county()
returns table(
  county text,
  discovery_records bigint,
  discovery_with_knec bigint,
  canonical_active bigint,
  canonical_with_strong_id bigint,
  authoritative_observations bigint,
  authoritative_matched bigint,
  authoritative_new_candidates bigint,
  authoritative_review bigint,
  canonical_to_discovery_ratio numeric,
  authoritative_resolution_ratio numeric
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(), false) then
    raise exception 'owner_authorization_required';
  end if;

  return query
  with discovery as (
    select
      coalesce(upper(nullif(trim(d.county),'')), 'UNKNOWN') as county,
      count(*)::bigint as records,
      count(*) filter (where nullif(trim(d.knec_code),'') is not null)::bigint as with_knec
    from public.schools_directory d
    group by 1
  ),
  canonical as (
    select
      coalesce(upper(nullif(trim(s.county),'')), 'UNKNOWN') as county,
      count(*) filter (where s.deleted_at is null and s.status = 'active')::bigint as active,
      count(*) filter (
        where s.deleted_at is null and s.status = 'active'
          and (
            nullif(trim(s.knec_code),'') is not null
            or nullif(trim(s.nemis_code),'') is not null
            or nullif(trim(s.moe_registration_no),'') is not null
            or nullif(trim(s.tsc_code),'') is not null
          )
      )::bigint as with_strong_id
    from public.schools s
    group by 1
  ),
  authority as (
    select
      coalesce(upper(nullif(trim(o.raw_record->>'county'),'')), 'UNKNOWN') as county,
      count(*)::bigint as observations,
      count(*) filter (where r.classification = 'matched')::bigint as matched,
      count(*) filter (where r.classification = 'new_candidate')::bigint as new_candidates,
      count(*) filter (where r.classification = 'review')::bigint as review
    from public.school_directory_source_observations o
    join public.school_directory_source_registry sr
      on sr.source_name = o.source_name
     and sr.authority_tier = 0
     and sr.canonical_use
     and sr.active
     and sr.verification_mode = 'authoritative'
    left join public.school_authoritative_reconciliation r
      on r.source_observation_id = o.id
    group by 1
  ),
  counties as (
    select county from discovery
    union
    select county from canonical
    union
    select county from authority
  )
  select
    c.county,
    coalesce(d.records,0)::bigint,
    coalesce(d.with_knec,0)::bigint,
    coalesce(k.active,0)::bigint,
    coalesce(k.with_strong_id,0)::bigint,
    coalesce(a.observations,0)::bigint,
    coalesce(a.matched,0)::bigint,
    coalesce(a.new_candidates,0)::bigint,
    coalesce(a.review,0)::bigint,
    case when coalesce(d.records,0) = 0 then null
      else round(coalesce(k.active,0)::numeric / d.records::numeric, 6)
    end as canonical_to_discovery_ratio,
    case when coalesce(a.observations,0) = 0 then null
      else round((coalesce(a.matched,0) + coalesce(a.new_candidates,0) + coalesce(a.review,0))::numeric / a.observations::numeric, 6)
    end as authoritative_resolution_ratio
  from counties c
  left join discovery d using (county)
  left join canonical k using (county)
  left join authority a using (county)
  order by
    case when c.county = 'UNKNOWN' then 1 else 0 end,
    c.county;
end;
$$;

revoke all on function public.hq_school_identity_coverage_by_county() from public, anon;
grant execute on function public.hq_school_identity_coverage_by_county() to authenticated;

comment on function public.hq_school_identity_coverage_by_county() is
'Owner-only School Identity coverage projection. Keeps directory discovery volume, canonical identities and Tier-0 authoritative observations/reconciliation separate. Missing county stays UNKNOWN; region is never substituted. Directory ratios are diagnostics only and are not claims of national completeness.';
