begin;

-- Keep compatibility with existing slot-creation RPCs.
-- The actual school-period check remains in the trigger below.
create or replace function
public.require_upper_primary_timetable_period(
  p_class_id uuid,
  p_day integer,
  p_start time,
  p_end time,
  p_units numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_grade text;
begin
  select c.grade_code into v_grade
  from public.classes c
  where c.id = p_class_id;

  if v_grade in ('Grade 4', 'Grade 5', 'Grade 6')
     and (
       p_day not between 1 and 5
       or p_units is distinct from 1
       or p_end - p_start <> interval '35 minutes'
     )
  then
    raise exception 'UPPER_PRIMARY_PERIOD_REQUIRED';
  end if;
end;
$$;

revoke all on function
  public.require_upper_primary_timetable_period(
    uuid, integer, time, time, numeric
  ) from public, anon;

grant execute on function
  public.require_upper_primary_timetable_period(
    uuid, integer, time, time, numeric
  ) to authenticated;


-- Replace the existing trigger implementation.
-- It continues using the existing school_periods table.
create or replace function
public.validate_timetable_slot_period()
returns trigger
language plpgsql
security invoker
set search_path = 'public', 'pg_temp'
as $$
declare
  v_grade text;
  v_minutes integer;
  v_normal boolean;
  v_period public.school_periods%rowtype;
  v_count integer;
  v_first time;
  v_last time;
  v_valid boolean;
begin
  -- A pure expiry/archival change must not retroactively invalidate
  -- a legacy schedule. Never let an edit expand the old effective window.
  if tg_op = 'UPDATE'
    and (
      new.school_id, new.class_id, new.day_of_week,
      new.start_time, new.end_time, new.period_id, new.allocation_units,
      new.effective_from
    ) is not distinct from (
      old.school_id, old.class_id, old.day_of_week,
      old.start_time, old.end_time, old.period_id, old.allocation_units,
      old.effective_from
    )
    and (
      new.effective_until is not distinct from old.effective_until
      or (
        new.effective_until is not null
        and (old.effective_until is null or new.effective_until <= old.effective_until)
      )
    )
  then
    return new;
  end if;

  select c.grade_code into v_grade
  from public.classes c
  where c.id = new.class_id
    and c.school_id = new.school_id;

  if not found then
    raise exception 'CLASS_SCHOOL_MISMATCH';
  end if;

  if v_grade is null then
    raise exception 'GRADE_IDENTITY_REQUIRED';
  end if;

  -- A single-date recovery is a dated exception.
  -- Ordinary weekly placements must use school periods.
  v_normal :=
    new.effective_until is null
    or new.effective_until <> new.effective_from;

  v_minutes := case
    when v_grade in ('Grade 4','Grade 5','Grade 6')
      then 35
    when v_grade in ('Grade 7','Grade 8','Grade 9')
      then 40
    else null
  end;

  if v_minutes is not null then
    if new.allocation_units is null
        or new.allocation_units <> trunc(new.allocation_units)
       or new.allocation_units not between 1 and 2
    then
      raise exception 'INVALID_LESSON_UNITS';
    end if;

    if v_grade in ('Grade 4','Grade 5','Grade 6')
       and new.allocation_units <> 1
    then
      raise exception 'UPPER_PRIMARY_PERIOD_REQUIRED';
    end if;

    if new.end_time - new.start_time
       <> make_interval(
         mins => v_minutes * new.allocation_units::integer
       )
    then
      raise exception 'LESSON_DURATION_MISMATCH';
    end if;

    if v_normal and new.day_of_week not between 1 and 5
    then
      raise exception 'SCHOOL_DAY_REQUIRED';
    end if;

    if v_normal and new.period_id is null then
      raise exception 'SCHOOL_PERIOD_REQUIRED';
    end if;
  end if;

  -- Preserve existing protected-break enforcement.
  if exists (
    select 1
    from public.school_periods sp
    where sp.school_id = new.school_id
      and sp.protected
      and sp.kind <> 'lesson'
      and sp.schedule_day in (0, new.day_of_week)
      and sp.start_time < new.end_time
      and sp.end_time > new.start_time
  ) then
    raise exception 'PROTECTED_SCHOOL_BLOCK';
  end if;

  if new.period_id is null then
    return new;
  end if;

  select * into v_period
  from public.school_periods
  where id = new.period_id;

  if not found or v_period.school_id <> new.school_id then
    raise exception 'PERIOD_SCHOOL_MISMATCH';
  end if;

  if v_period.kind <> 'lesson'
     or v_period.schedule_day not in (0, new.day_of_week)
  then
    raise exception 'NON_TEACHING_PERIOD';
  end if;

  if v_period.start_time <> new.start_time then
    raise exception 'PERIOD_TIME_MISMATCH';
  end if;

  -- For a multi-unit lesson, validate every consecutive
  -- configured teaching period, not just the first.
  with ordered as (
    select
      sp.start_time,
      sp.end_time,
      lag(sp.end_time) over(
        order by sp.start_time, sp.id
      ) as previous_end
    from public.school_periods sp
    where sp.school_id = new.school_id
      and sp.schedule_day in (0, new.day_of_week)
      and sp.kind = 'lesson'
      and sp.start_time >= new.start_time
      and sp.end_time <= new.end_time
  )
  select
    count(*)::integer,
    min(start_time),
    max(end_time),
    coalesce(
      bool_and(
        (previous_end is null or previous_end = start_time)
        and (
          v_minutes is null
          or end_time - start_time =
             make_interval(mins => v_minutes)
        )
      ),
      false
    )
  into v_count, v_first, v_last, v_valid
  from ordered;

  if v_first <> new.start_time
     or v_last <> new.end_time
     or not v_valid
     or (
       v_minutes is not null
       and v_count <> new.allocation_units::integer
     )
  then
    raise exception 'PERIOD_TIME_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists
  timetable_slot_period_guard
  on public.timetable_slots;

create trigger timetable_slot_period_guard
before insert or update of
  school_id, class_id, day_of_week,
  start_time, end_time,
  period_id, allocation_units,
  effective_from, effective_until
on public.timetable_slots
for each row
execute function public.validate_timetable_slot_period();

commit;
