-- Public, read-only approximate school directory map coordinates.
-- Source values may be historical or imprecise; never imply verified campus entrances.
-- A public URL must exist for each emitted record; closed/deleted records are excluded.
create or replace function public.schools_public_approx_location_v1(
  p_kind text, p_source_id uuid
)
returns table(latitude double precision, longitude double precision)
language sql stable security definer set search_path=public,pg_temp as $$
  select d.latitude::double precision, d.longitude::double precision
  from public.schools_directory d
  where p_kind='directory' and d.id=p_source_id
    and lower(coalesce(d.status,''))<>'closed'
    and d.latitude between -5 and 5 and d.longitude between 33 and 42
    and exists(select 1 from public.school_public_urls u where u.directory_id=d.id)
  union all
  select s.gps_lat::double precision, s.gps_lng::double precision
  from public.schools s
  where p_kind='canonical' and s.id=p_source_id
    and s.deleted_at is null and s.status='active'
    and s.gps_lat between -5 and 5 and s.gps_lng between 33 and 42
    and exists(select 1 from public.school_public_urls u where u.school_id=s.id)
$$;
revoke all on function public.schools_public_approx_location_v1(text,uuid) from public;
grant execute on function public.schools_public_approx_location_v1(text,uuid) to anon,authenticated;
comment on function public.schools_public_approx_location_v1(text,uuid) is
'Public historical/approximate map coordinates for URL-listed schools. Presence does not prove campus-level location verification.';
