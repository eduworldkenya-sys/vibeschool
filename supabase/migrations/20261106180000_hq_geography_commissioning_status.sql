-- access: owner-only public.hq_geography_commissioning_status()
-- authorization-test: public.hq_geography_commissioning_status()
-- Read-only commissioning evidence; does not promote unverified records or merge electoral and administrative units.
create or replace function public.hq_geography_commissioning_status()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_status jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;
  select jsonb_build_object(
    'counties_total', (select count(*) from public.geo_counties where status='active'),
    'counties_verified', (select count(*) from public.geo_counties where status='active' and verification_state='verified'),
    'subcounties_total', (select count(*) from public.geo_subcounties where status='active'),
    'subcounties_verified', (select count(*) from public.geo_subcounties where status='active' and verification_state='verified'),
    'wards_total', (select count(*) from public.geo_wards where status='active'),
    'wards_verified', (select count(*) from public.geo_wards where status='active' and verification_state='verified'),
    'nakuru_legacy_subcounty_candidates', (select count(distinct lower(trim(sub_county))) from public.kenya_administrative_areas where lower(county)='nakuru' and nullif(trim(sub_county),'') is not null),
    'nakuru_legacy_ward_candidates', (select count(*) from public.kenya_administrative_areas where lower(county)='nakuru' and nullif(trim(ward),'') is not null),
    'nakuru_unverified_subcounties', coalesce((
      select jsonb_agg(jsonb_build_object('name',s.official_name,'source',s.source_key,'state',s.verification_state) order by s.official_name)
      from public.geo_subcounties s join public.geo_counties c on c.id=s.county_id
      where c.official_code='032' and s.status='active' and s.verification_state<>'verified'
    ),'[]'::jsonb),
    'generated_at',now()
  ) into v_status;
  return v_status;
end;
$$;
revoke all on function public.hq_geography_commissioning_status() from public, anon, authenticated;
grant execute on function public.hq_geography_commissioning_status() to authenticated;
