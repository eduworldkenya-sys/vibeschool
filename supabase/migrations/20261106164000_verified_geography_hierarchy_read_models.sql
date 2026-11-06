-- Approved-only public projections of the protected geographic hierarchy.
-- Intentionally empty for a county until its children are verified by HQ.
-- Do not silently substitute constituencies for national-government subcounties.

create or replace function public.list_kenya_subcounties(p_county_code text)
returns table (id uuid, official_code text, official_name text, county_code text)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.official_code::text, s.official_name::text, c.official_code::text
  from public.geo_subcounties s
  join public.geo_counties c on c.id = s.county_id
  join public.geo_countries country on country.id = c.country_id
  where country.iso2 = 'KE' and country.status = 'active'
    and c.status = 'active' and c.verification_state = 'verified'
    and s.status = 'active' and s.verification_state = 'verified'
    and c.official_code = p_county_code
  order by s.official_name, s.id;
$$;
revoke all on function public.list_kenya_subcounties(text) from public;
grant execute on function public.list_kenya_subcounties(text) to anon, authenticated;

create or replace function public.list_kenya_wards(p_subcounty_id uuid)
returns table (id uuid, official_code text, official_name text, subcounty_id uuid)
language sql stable security definer set search_path = ''
as $$
  select w.id, w.official_code::text, w.official_name::text, w.subcounty_id
  from public.geo_wards w
  join public.geo_subcounties s on s.id = w.subcounty_id
  join public.geo_counties c on c.id = s.county_id
  join public.geo_countries country on country.id = c.country_id
  where country.iso2 = 'KE' and country.status = 'active'
    and c.status = 'active' and c.verification_state = 'verified'
    and s.status = 'active' and s.verification_state = 'verified'
    and w.status = 'active' and w.verification_state = 'verified'
    and w.subcounty_id = p_subcounty_id
  order by w.official_name, w.id;
$$;
revoke all on function public.list_kenya_wards(uuid) from public;
grant execute on function public.list_kenya_wards(uuid) to anon, authenticated;
