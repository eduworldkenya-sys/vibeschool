-- Task 7: authoritative, idempotent School Admin academic-term operations.

create or replace function public.admin_upsert_academic_term(
  p_school_id uuid,
  p_term integer,
  p_academic_year integer,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then
    raise exception 'school_admin_required' using errcode = '42501';
  end if;
  if p_term not in (1,2,3) or p_academic_year < 2000 or p_academic_year > 2100 then
    raise exception 'invalid_academic_term' using errcode = '22023';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'invalid_term_dates' using errcode = '22023';
  end if;

  insert into public.academic_terms (
    school_id, name, term, academic_year, start_date, end_date, status
  ) values (
    p_school_id,
    'Term ' || p_term::text,
    p_term,
    p_academic_year,
    p_start_date,
    p_end_date,
    'upcoming'
  )
  on conflict (school_id, term, academic_year)
  do update set
    name = excluded.name,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_academic_term(uuid,integer,integer,date,date) from public, anon;
grant execute on function public.admin_upsert_academic_term(uuid,integer,integer,date,date) to authenticated, service_role;

create or replace function public.admin_activate_academic_term(
  p_school_id uuid,
  p_term_id uuid
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
  if not exists (
    select 1 from public.academic_terms
    where id = p_term_id and school_id = p_school_id
  ) then
    raise exception 'term_not_in_school' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text || ':academic-term', 0));

  update public.academic_terms
  set status = 'completed', updated_at = now()
  where school_id = p_school_id
    and status = 'active'
    and id <> p_term_id;

  update public.academic_terms
  set status = 'active', updated_at = now()
  where id = p_term_id
    and school_id = p_school_id;
end;
$$;

revoke all on function public.admin_activate_academic_term(uuid,uuid) from public, anon;
grant execute on function public.admin_activate_academic_term(uuid,uuid) to authenticated, service_role;

create or replace function public.admin_delete_unused_academic_term(
  p_school_id uuid,
  p_term_id uuid
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
  if exists (
    select 1 from public.academic_terms t
    where t.id = p_term_id and t.school_id = p_school_id and t.status = 'active'
  ) then
    raise exception 'active_term_cannot_be_deleted' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.scheme_of_work s
    where s.school_id = p_school_id and s.academic_term_id = p_term_id
  ) then
    raise exception 'term_has_academic_history' using errcode = '23514';
  end if;

  delete from public.academic_terms
  where id = p_term_id
    and school_id = p_school_id;
end;
$$;

revoke all on function public.admin_delete_unused_academic_term(uuid,uuid) from public, anon;
grant execute on function public.admin_delete_unused_academic_term(uuid,uuid) to authenticated, service_role;
