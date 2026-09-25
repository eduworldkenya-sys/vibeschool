-- Canonical school-time intelligence for timetable periods.
-- Extends the existing school_periods authority without replacing timetable_slots.
-- Existing rows become all-days (schedule_day=0), preserving current behaviour.

alter table public.school_periods
  add column if not exists schedule_day integer not null default 0,
  add column if not exists protected boolean not null default false;

alter table public.school_periods
  drop constraint if exists school_periods_kind_check,
  drop constraint if exists school_periods_number_unique;

alter table public.school_periods
  add constraint school_periods_schedule_day_check
    check (schedule_day between 0 and 7),
  add constraint school_periods_kind_check
    check (kind in (
      'lesson','break','lunch','assembly','games','club','prep',
      'staff_meeting','guidance','examination','school_event','free','custom'
    ));

create unique index if not exists school_periods_school_day_number_unique
  on public.school_periods(school_id, schedule_day, period_number);

create index if not exists school_periods_school_day_time_idx
  on public.school_periods(school_id, schedule_day, start_time, end_time);

drop policy if exists school_periods_active_member_read on public.school_periods;
create policy school_periods_active_member_read
on public.school_periods for select to authenticated
using (public.is_active_school_member(school_id));

create or replace function public.validate_school_period_overlap()
returns trigger
language plpgsql
set search_path=public
as $
begin
  if exists (
    select 1 from public.school_periods sp
    where sp.school_id=new.school_id
      and sp.id is distinct from new.id
      and (sp.schedule_day=0 or new.schedule_day=0 or sp.schedule_day=new.schedule_day)
      and sp.start_time < new.end_time
      and sp.end_time > new.start_time
  ) then
    raise exception 'SCHOOL_PERIOD_OVERLAP';
  end if;
  return new;
end
$;

drop trigger if exists school_period_overlap_guard on public.school_periods;
create trigger school_period_overlap_guard
before insert or update of school_id,schedule_day,start_time,end_time
on public.school_periods
for each row execute function public.validate_school_period_overlap();

-- Non-teaching blocks are protected by default. Existing legacy break rows
-- become protected without changing their labels or times.
update public.school_periods
set protected = true
where kind <> 'lesson' and protected = false;

-- Server-authoritative guard: a lesson slot linked to a period must use a
-- teaching period from the same school and must match its canonical times.
create or replace function public.validate_timetable_slot_period()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_period public.school_periods;
begin
  -- A lesson may never overlap a protected non-teaching block, even when
  -- the legacy/custom slot has no period_id.
  if exists (
    select 1 from public.school_periods sp
    where sp.school_id=new.school_id
      and sp.protected
      and sp.kind <> 'lesson'
      and sp.schedule_day in (0,new.day_of_week)
      and sp.start_time < new.end_time
      and sp.end_time > new.start_time
  ) then
    raise exception 'PROTECTED_SCHOOL_BLOCK';
  end if;

  if new.period_id is null then
    return new;
  end if;

  select * into v_period from public.school_periods where id=new.period_id;
  if v_period.id is null or v_period.school_id is distinct from new.school_id then
    raise exception 'PERIOD_SCHOOL_MISMATCH';
  end if;
  if v_period.kind <> 'lesson' then
    raise exception 'NON_TEACHING_PERIOD';
  end if;
  if v_period.schedule_day not in (0,new.day_of_week) then
    raise exception 'PERIOD_DAY_MISMATCH';
  end if;
  if new.start_time is distinct from v_period.start_time or new.end_time is distinct from v_period.end_time then
    raise exception 'PERIOD_TIME_MISMATCH';
  end if;
  return new;
end
$$;

drop trigger if exists timetable_slot_period_guard on public.timetable_slots;
create trigger timetable_slot_period_guard
before insert or update of school_id,day_of_week,start_time,end_time,period_id
on public.timetable_slots
for each row execute function public.validate_timetable_slot_period();

-- Read model used by Smart and Classic timetable projections.
create or replace function public.get_my_school_day_blocks()
returns table(
  id uuid,
  school_id uuid,
  schedule_day integer,
  period_number integer,
  label text,
  start_time time,
  end_time time,
  kind text,
  protected boolean
)
language sql
security invoker
set search_path=public
stable
as $$
  select sp.id,sp.school_id,sp.schedule_day,sp.period_number,sp.label,
         sp.start_time,sp.end_time,sp.kind,sp.protected
  from public.school_periods sp
  where public.is_active_school_member(sp.school_id)
  order by sp.schedule_day,sp.start_time,sp.period_number;
$$;

revoke all on function public.get_my_school_day_blocks() from public,anon;
grant execute on function public.get_my_school_day_blocks() to authenticated;
