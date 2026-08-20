\set ON_ERROR_STOP on
begin;

-- Canonical Kenya geography baseline.
do $$
declare v_country_count integer; v_county_count integer;
begin
  select count(*) into v_country_count from public.geo_countries where iso2='KE' and verification_state='verified';
  if v_country_count <> 1 then raise exception 'expected exactly one verified Kenya geography row, got %',v_country_count; end if;
  select count(*) into v_county_count
  from public.geo_counties c join public.geo_countries g on g.id=c.country_id
  where g.iso2='KE' and c.status='active' and c.verification_state='verified';
  if v_county_count <> 47 then raise exception 'expected 47 verified Kenya counties, got %',v_county_count; end if;
end $$;

-- Queue is private and protected exactly like the HQ geography tables.
do $$
declare v_rls boolean;
begin
  select c.relrowsecurity into v_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='school_geography_reconciliation_queue';
  if not coalesce(v_rls,false) then raise exception 'reconciliation queue must have RLS enabled'; end if;

  if has_table_privilege('public','public.school_geography_reconciliation_queue','SELECT')
     or has_table_privilege('anon','public.school_geography_reconciliation_queue','SELECT')
     or has_table_privilege('authenticated','public.school_geography_reconciliation_queue','SELECT')
     or has_table_privilege('anon','public.school_geography_reconciliation_queue','INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','public.school_geography_reconciliation_queue','INSERT,UPDATE,DELETE') then
    raise exception 'browser roles must have no direct reconciliation queue privileges';
  end if;
end $$;

-- Every active canonical school must be in exactly one state: mapped or pending review.
do $$
declare v_bad integer;
begin
  with state as (
    select s.id,
      (sg.school_id is not null)::integer as mapped,
      (q.school_id is not null and q.status='pending')::integer as pending
    from public.schools s
    left join public.school_geography sg on sg.school_id=s.id
    left join public.school_geography_reconciliation_queue q on q.school_id=s.id
    where s.deleted_at is null
  )
  select count(*) into v_bad from state where mapped + pending <> 1;
  if v_bad <> 0 then raise exception '% active schools are neither exactly mapped nor pending',v_bad; end if;
end $$;

-- Promoted geography must retain valid coordinates and full provenance.
do $$
declare v_bad integer;
begin
  select count(*) into v_bad
  from public.school_geography
  where (latitude is not null and latitude not between -90 and 90)
     or (longitude is not null and longitude not between -180 and 180)
     or source_key is null
     or source_version is null
     or source_ref is null
     or confidence is null;
  if v_bad <> 0 then raise exception '% geography rows have invalid coordinates or incomplete provenance',v_bad; end if;
end $$;

-- This commissioning migration may only claim verified geography from an existing
-- sealed Tier-0 canonical identity decision. Discovery/name matches remain inferred.
do $$
declare v_bad integer;
begin
  select count(*) into v_bad
  from public.school_geography sg
  where sg.verification_state='verified'
    and sg.source_key='school_identity_sealed_tier0'
    and not exists (
      select 1
      from public.school_identity_candidates c
      join public.schools_directory d on d.id=c.directory_school_id
      where c.canonical_school_id=sg.school_id
        and c.status='matched'
        and c.confidence=1.0000
        and c.match_reason='sealed_tier0_exact_identifier'
        and d.is_verified=true
        and d.id::text=sg.source_ref
    );
  if v_bad <> 0 then raise exception '% sealed Tier-0 verified geography rows lack canonical identity proof',v_bad; end if;

  select count(*) into v_bad
  from public.school_geography
  where source_key in ('schools_directory_unique_exact_name','schools_directory_unique_exact_identifier')
    and verification_state <> 'inferred';
  if v_bad <> 0 then raise exception '% discovery-only geography rows were incorrectly promoted beyond inferred',v_bad; end if;
end $$;

-- Geography hierarchy may not cross country/county/subcounty boundaries.
do $$
declare v_bad integer;
begin
  select count(*) into v_bad
  from public.school_geography sg
  left join public.geo_counties c on c.id=sg.county_id
  left join public.geo_subcounties sc on sc.id=sg.subcounty_id
  where (sg.county_id is not null and c.id is null)
     or (sg.country_id is not null and c.country_id is distinct from sg.country_id)
     or (sg.subcounty_id is not null and sc.county_id is distinct from sg.county_id);
  if v_bad <> 0 then raise exception '% school geography rows violate hierarchy integrity',v_bad; end if;
end $$;

rollback;
