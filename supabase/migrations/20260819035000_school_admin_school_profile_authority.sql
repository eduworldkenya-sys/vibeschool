-- Task 7: School Admin school-profile operations.
-- The canonical identity codes and provenance fields are deliberately read-only
-- to ordinary School Admins. Operational profile fields may be maintained through
-- this school-bound RPC without granting broad UPDATE on public.schools.

create or replace function public.admin_update_school_profile(
  p_school_id uuid,
  p_name text,
  p_motto text default null,
  p_vision text default null,
  p_county text default null,
  p_sub_county text default null,
  p_ward text default null,
  p_phone text default null,
  p_postal_address text default null,
  p_school_type text default null,
  p_school_category text default null,
  p_established_year integer default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then
    raise exception 'school_admin_required' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'school_name_required' using errcode = '22023';
  end if;
  if p_established_year is not null and (p_established_year < 1800 or p_established_year > extract(year from current_date)::integer) then
    raise exception 'invalid_established_year' using errcode = '22023';
  end if;

  update public.schools
  set name = btrim(p_name),
      name_normalized = lower(regexp_replace(btrim(p_name), '[^a-zA-Z0-9]+', '', 'g')),
      motto = nullif(btrim(coalesce(p_motto, '')), ''),
      vision = nullif(btrim(coalesce(p_vision, '')), ''),
      county = nullif(btrim(coalesce(p_county, '')), ''),
      sub_county = nullif(btrim(coalesce(p_sub_county, '')), ''),
      ward = nullif(btrim(coalesce(p_ward, '')), ''),
      phone = nullif(btrim(coalesce(p_phone, '')), ''),
      postal_address = nullif(btrim(coalesce(p_postal_address, '')), ''),
      school_type = nullif(btrim(coalesce(p_school_type, '')), ''),
      school_category = nullif(btrim(coalesce(p_school_category, '')), ''),
      established_year = p_established_year::smallint,
      updated_at = clock_timestamp()
  where id = p_school_id
    and deleted_at is null;

  if not found then
    raise exception 'school_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_update_school_profile(uuid,text,text,text,text,text,text,text,text,text,text,integer) from public, anon;
grant execute on function public.admin_update_school_profile(uuid,text,text,text,text,text,text,text,text,text,text,integer) to authenticated, service_role;
