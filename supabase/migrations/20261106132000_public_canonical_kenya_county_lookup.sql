-- Read-only, public projection of the approved Kenya geographic registry.
-- Source of truth remains geo_counties; no direct table grants or writes.
create or replace function public.list_kenya_counties()
returns table (code text, official_name text, display_name text)
language sql stable security definer
set search_path = ''
as $$
  select c.official_code::text, c.official_name::text,
    case c.official_code
      when '047' then 'Nairobi'
      when '006' then 'Taita-Taveta'
      when '028' then 'Elgeyo-Marakwet'
      else c.official_name
    end::text as display_name
  from public.geo_counties c
  join public.geo_countries country on country.id = c.country_id
  where country.iso2 = 'KE'
    and country.status = 'active'
    and c.status = 'active'
    and c.verification_state = 'verified'
  order by display_name;
$$;
revoke all on function public.list_kenya_counties() from public;
grant execute on function public.list_kenya_counties() to anon, authenticated;
