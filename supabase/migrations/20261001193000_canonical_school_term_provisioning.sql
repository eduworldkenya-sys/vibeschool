begin;

create schema if not exists private;

create table if not exists public.national_term_calendar (
  country_code char(2) not null default 'KE',
  academic_year integer not null,
  term integer not null check (term in (1,2,3)),
  start_date date not null,
  end_date date not null,
  source text,
  created_at timestamptz not null default now(),
  primary key (country_code, academic_year, term),
  check (end_date > start_date)
);

alter table public.national_term_calendar enable row level security;

drop policy if exists ntc_read on public.national_term_calendar;
create policy ntc_read on public.national_term_calendar
  for select to authenticated using (true);

revoke all on table public.national_term_calendar from public, anon, authenticated, service_role;
grant select on table public.national_term_calendar to authenticated, service_role;

insert into public.national_term_calendar
  (country_code, academic_year, term, start_date, end_date, source)
values
  ('KE', 2026, 1, date '2026-01-06', date '2026-04-02', 'Kenya basic education 2026 calendar (owner-supplied dates)'),
  ('KE', 2026, 2, date '2026-04-27', date '2026-07-31', 'Kenya basic education 2026 calendar (owner-supplied dates)'),
  ('KE', 2026, 3, date '2026-08-24', date '2026-10-23', 'Kenya basic education 2026 calendar (owner-supplied dates)')
on conflict (country_code, academic_year, term) do update
set start_date=excluded.start_date,
    end_date=excluded.end_date,
    source=excluded.source;

alter table public.academic_terms
  drop constraint if exists academic_terms_school_term_year_unique;

update public.term_weeks tw
set school_id = at.school_id
from public.academic_terms at
where at.id = tw.term_id
  and tw.school_id is null;

create unique index if not exists term_weeks_term_week_unique
  on public.term_weeks(term_id, week_number);

create or replace function private.generate_term_weeks_internal(p_term_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_start date; v_end date; v_school_id uuid; v_week integer:=1; v_cursor date;
begin
  select at.start_date,at.end_date,at.school_id into v_start,v_end,v_school_id
  from public.academic_terms at where at.id=p_term_id;
  if v_start is null or v_end is null or v_school_id is null then return; end if;
  v_cursor:=v_start;
  while v_cursor<=v_end loop
    insert into public.term_weeks(school_id,term_id,week_number,start_date,end_date,week_type)
    values(v_school_id,p_term_id,v_week,v_cursor,least(v_cursor+6,v_end),'normal')
    on conflict(term_id,week_number) do nothing;
    v_cursor:=v_cursor+7; v_week:=v_week+1;
  end loop;
end $$;
revoke all on function private.generate_term_weeks_internal(uuid) from public,anon,authenticated,service_role;

create or replace function public.generate_term_weeks(p_term_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_school_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select at.school_id into v_school_id from public.academic_terms at where at.id=p_term_id;
  if v_school_id is null or not public.is_school_admin(v_school_id) then raise exception 'not_authorized'; end if;
  perform private.generate_term_weeks_internal(p_term_id);
end $$;
revoke all on function public.generate_term_weeks(uuid) from public,anon;
grant execute on function public.generate_term_weeks(uuid) to authenticated;

create or replace function public.handle_academic_term_created()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.generate_term_weeks_internal(new.id);
  return new;
end $$;
revoke all on function public.handle_academic_term_created() from public,anon,authenticated;

create or replace function private.ensure_school_term_internal(
  p_school_id uuid,
  p_reference_date date default current_date
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_country char(2); v_calendar record; v_term_id uuid; v_status text;
begin
  select upper(trim(s.country_code))::char(2) into v_country
  from public.schools s where s.id=p_school_id and s.deleted_at is null;
  if v_country is null then return null; end if;

  select ntc.* into v_calendar
  from public.national_term_calendar ntc
  where upper(trim(ntc.country_code))=upper(trim(v_country))
    and (p_reference_date between ntc.start_date and ntc.end_date or ntc.start_date>p_reference_date)
  order by case when p_reference_date between ntc.start_date and ntc.end_date then 0 else 1 end,ntc.start_date
  limit 1;
  if v_calendar.academic_year is null then return null; end if;

  v_status:=case
    when current_date<v_calendar.start_date then 'upcoming'
    when current_date>v_calendar.end_date then 'completed'
    else 'active'
  end;

  insert into public.academic_terms(school_id,name,term,academic_year,start_date,end_date,status)
  values(p_school_id,'Term '||v_calendar.term::text,v_calendar.term,v_calendar.academic_year,
         v_calendar.start_date,v_calendar.end_date,v_status)
  on conflict(school_id,term,academic_year)
  do update set status=excluded.status
  returning id into v_term_id;

  if v_term_id is null then
    select at.id into v_term_id from public.academic_terms at
    where at.school_id=p_school_id and at.term=v_calendar.term and at.academic_year=v_calendar.academic_year;
  end if;

  if v_term_id is not null then perform private.generate_term_weeks_internal(v_term_id); end if;
  return v_term_id;
end $$;
revoke all on function private.ensure_school_term_internal(uuid,date) from public,anon,authenticated,service_role;

create or replace function public.ensure_school_term(
  p_school_id uuid,
  p_reference_date date default current_date
)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_school_admin(p_school_id) then raise exception 'not_authorized'; end if;
  return private.ensure_school_term_internal(p_school_id,p_reference_date);
end $$;
revoke all on function public.ensure_school_term(uuid,date) from public,anon;
grant execute on function public.ensure_school_term(uuid,date) to authenticated;

create or replace function public.ensure_my_active_school_term(
  p_reference_date date default current_date
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=auth.uid(); v_school_id uuid; v_memberships integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select tasp.school_id into v_school_id
  from public.teacher_active_school_preferences tasp
  join public.school_members sm on sm.school_id=tasp.school_id and sm.profile_id=v_uid
  join public.schools s on s.id=tasp.school_id and s.deleted_at is null
  where tasp.teacher_id=v_uid limit 1;

  if v_school_id is null then
    select count(*),min(sm.school_id) into v_memberships,v_school_id
    from public.school_members sm
    join public.schools s on s.id=sm.school_id and s.deleted_at is null
    where sm.profile_id=v_uid;
    if v_memberships<>1 then raise exception 'active_school_required'; end if;
  end if;

  return private.ensure_school_term_internal(v_school_id,p_reference_date);
end $$;
revoke all on function public.ensure_my_active_school_term(date) from public,anon;
grant execute on function public.ensure_my_active_school_term(date) to authenticated;

create or replace function private.handle_school_term_provisioning()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is null then perform private.ensure_school_term_internal(new.id,current_date); end if;
  return new;
end $$;
revoke all on function private.handle_school_term_provisioning() from public,anon,authenticated,service_role;

drop trigger if exists trg_provision_school_term on public.schools;
create trigger trg_provision_school_term
after insert on public.schools
for each row execute function private.handle_school_term_provisioning();

create or replace function private.reconcile_school_terms()
returns integer language plpgsql security definer set search_path='' as $$
declare r record; v_count integer:=0; v_term_id uuid;
begin
  for r in select s.id from public.schools s
           where s.deleted_at is null and upper(trim(s.country_code))='KE'
  loop
    v_term_id:=private.ensure_school_term_internal(r.id,current_date);
    if v_term_id is not null then v_count:=v_count+1; end if;
  end loop;
  return v_count;
end $$;
revoke all on function private.reconcile_school_terms() from public,anon,authenticated,service_role;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='vibeschool-school-term-reconcile' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule('vibeschool-school-term-reconcile','15 1 * * *','select private.reconcile_school_terms();');
end $$;

create or replace view private.school_term_health as
with current_calendar as (
  select ntc.* from public.national_term_calendar ntc
  where upper(trim(ntc.country_code))='KE'
    and current_date between ntc.start_date and ntc.end_date
), school_base as (
  select s.id school_id,s.name school_name,s.status school_status,
         cc.academic_year,cc.term,cc.start_date default_start_date,cc.end_date default_end_date
  from public.schools s left join current_calendar cc on true
  where s.deleted_at is null and upper(trim(s.country_code))='KE'
), facts as (
  select sb.*,at.id academic_term_id,at.start_date school_start_date,at.end_date school_end_date,
         at.status term_status,
         (select count(*) from public.term_weeks tw where tw.term_id=at.id) week_count,
         (select count(*) from public.academic_terms x
          where x.school_id=sb.school_id and current_date between x.start_date and x.end_date) current_term_count
  from school_base sb
  left join public.academic_terms at
    on at.school_id=sb.school_id and at.academic_year=sb.academic_year and at.term=sb.term
)
select f.*,
  case
    when f.academic_year is null then 'STALE_DEFAULT'
    when f.current_term_count>1 then 'OVERLAPPING_TERMS'
    when f.academic_term_id is null then 'NO_CURRENT_TERM'
    when f.school_end_date<=f.school_start_date then 'INVALID_DATES'
    when coalesce(f.week_count,0)=0 then 'TERM_WITHOUT_WEEKS'
    when f.school_start_date is distinct from f.default_start_date
      or f.school_end_date is distinct from f.default_end_date then 'OVERRIDE'
    else 'OK'
  end health_state
from facts f;
revoke all on private.school_term_health from public,anon,authenticated;

select private.reconcile_school_terms();
notify pgrst,'reload schema';

commit;
