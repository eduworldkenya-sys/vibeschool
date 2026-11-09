begin;

-- authorization-test: existing teacher and school admin writers retain their assignment and tenant checks.
-- The Ministry CBE timetable (section 2.3 / appendix 3) uses seven
-- single 35-minute upper-primary periods. Preserve existing placements.
create or replace function public.require_upper_primary_timetable_period(
  p_class_id uuid, p_day integer, p_start time, p_end time, p_units numeric
) returns void
language plpgsql
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id and lower(btrim(c.name)) in ('grade 4', 'grade 5', 'grade 6')
  ) then
    return;
  end if;

  if p_day is null or p_start is null or p_end is null
     or p_day not between 1 and 5 or p_units is distinct from 1
     or (p_start, p_end) not in (
       (time '08:20', time '08:55'), (time '08:55', time '09:30'),
       (time '09:50', time '10:25'), (time '10:25', time '11:00'),
       (time '11:30', time '12:05'), (time '12:05', time '12:40'),
       (time '14:00', time '14:35')
     ) then
    raise exception 'UPPER_PRIMARY_PERIOD_REQUIRED';
  end if;
end
$function$;

revoke execute on function public.require_upper_primary_timetable_period(uuid,integer,time,time,numeric)
  from public, anon;
grant execute on function public.require_upper_primary_timetable_period(uuid,integer,time,time,numeric)
  to authenticated;

-- Placement changes are validated. Undo can still restore an existing snapshot.
create or replace function public.validate_upper_primary_timetable_slot()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if (new.class_id, new.day_of_week, new.start_time, new.end_time, new.allocation_units)
     is distinct from
     (old.class_id, old.day_of_week, old.start_time, old.end_time, old.allocation_units) then
    perform public.require_upper_primary_timetable_period(
      new.class_id, new.day_of_week, new.start_time, new.end_time, new.allocation_units
    );
  end if;
  return new;
end
$function$;

revoke execute on function public.validate_upper_primary_timetable_slot() from public, anon, authenticated;

create trigger timetable_slot_upper_primary_period_guard
before update of class_id, day_of_week, start_time, end_time, allocation_units
on public.timetable_slots
for each row execute function public.validate_upper_primary_timetable_slot();

create or replace function public.create_timetable_slot_v2(
  p_class_id uuid,p_subject_id uuid,p_day_of_week integer,p_start_time time,p_end_time time,
  p_room text default null,p_effective_from date default null,p_effective_until date default null,
  p_allocation_units numeric default 1,p_period_id uuid default null
) returns public.timetable_slots
language plpgsql security definer set search_path=public
as $$
declare
  v_teacher_id uuid:=auth.uid(); v_school_id uuid; v_class_school_id uuid;
  v_effective_from date:=coalesce(p_effective_from,(now() at time zone 'Africa/Nairobi')::date);
  v_new public.timetable_slots; v_constraint text;
begin
  if v_teacher_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_class_id is null or p_subject_id is null then raise exception 'INVALID_ASSIGNMENT'; end if;
  if p_day_of_week is null or p_day_of_week<1 or p_day_of_week>7 then raise exception 'INVALID_DAY'; end if;
  if p_start_time is null or p_end_time is null or p_start_time>=p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_effective_until is not null and p_effective_until<v_effective_from then raise exception 'INVALID_EFFECTIVE_RANGE'; end if;
  if p_allocation_units is null or p_allocation_units<=0 or p_allocation_units>8 then raise exception 'INVALID_ALLOCATION_UNITS'; end if;
  select tc.school_id into v_school_id from public.teacher_classes tc
    where tc.teacher_id=v_teacher_id and tc.class_id=p_class_id and tc.subject_id=p_subject_id limit 1;
  if v_school_id is null then raise exception 'INVALID_ASSIGNMENT'; end if;
  select c.school_id into v_class_school_id from public.classes c where c.id=p_class_id;
  if v_class_school_id is distinct from v_school_id then raise exception 'SCHOOL_MISMATCH'; end if;
  if p_period_id is not null and not exists(select 1 from public.school_periods sp where sp.id=p_period_id and sp.school_id=v_school_id) then raise exception 'PERIOD_SCHOOL_MISMATCH'; end if;
  perform public.require_upper_primary_timetable_period(
    p_class_id, p_day_of_week, p_start_time, p_end_time, p_allocation_units
  );
  begin
    insert into public.timetable_slots(school_id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,room,period_id,allocation_units,recurrence_pattern,effective_from,effective_until)
    values(v_school_id,v_teacher_id,p_class_id,p_subject_id,p_day_of_week,p_start_time,p_end_time,nullif(btrim(p_room),''),p_period_id,p_allocation_units,'EVERY_WEEK',v_effective_from,p_effective_until)
    returning * into v_new;
  exception when exclusion_violation then
    get stacked diagnostics v_constraint=constraint_name;
    if v_constraint='excl_teacher_overlap' then raise exception 'TEACHER_CONFLICT';
    elsif v_constraint='excl_class_overlap' then raise exception 'CLASS_CONFLICT';
    elsif v_constraint='excl_room_overlap' then raise exception 'ROOM_CONFLICT';
    else raise exception 'SCHEDULE_CONFLICT'; end if;
  when unique_violation then raise exception 'DUPLICATE_SLOT'; end;
  return v_new;
end;
$$;
create or replace function public.create_school_timetable_slot(
  p_school_id uuid,p_teacher_id uuid,p_class_id uuid,p_subject_id uuid,p_day_of_week integer,
  p_start_time time,p_end_time time,p_room text default null,p_effective_from date default null,
  p_effective_until date default null,p_allocation_units numeric default 1,p_period_id uuid default null
) returns public.timetable_slots
language plpgsql security definer set search_path=public
as $$
declare
  v_effective_from date:=coalesce(p_effective_from,(now() at time zone 'Africa/Nairobi')::date);
  v_new public.timetable_slots; v_constraint text;
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=p_school_id) then raise exception 'CLASS_SCHOOL_MISMATCH'; end if;
  if not exists(select 1 from public.subjects s where s.id=p_subject_id and (s.school_id=p_school_id or s.school_id is null)) then raise exception 'SUBJECT_SCHOOL_MISMATCH'; end if;
  if p_teacher_id is not null and not exists(select 1 from public.teacher_classes tc where tc.school_id=p_school_id and tc.teacher_id=p_teacher_id and tc.class_id=p_class_id and tc.subject_id=p_subject_id) then raise exception 'TEACHER_ASSIGNMENT_REQUIRED'; end if;
  if p_day_of_week is null or p_day_of_week<1 or p_day_of_week>7 then raise exception 'INVALID_DAY'; end if;
  if p_start_time is null or p_end_time is null or p_start_time>=p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_effective_until is not null and p_effective_until<v_effective_from then raise exception 'INVALID_EFFECTIVE_RANGE'; end if;
  if p_allocation_units is null or p_allocation_units<=0 or p_allocation_units>8 then raise exception 'INVALID_ALLOCATION_UNITS'; end if;
  if p_period_id is not null and not exists(select 1 from public.school_periods sp where sp.id=p_period_id and sp.school_id=p_school_id) then raise exception 'PERIOD_SCHOOL_MISMATCH'; end if;
  perform public.require_upper_primary_timetable_period(
    p_class_id, p_day_of_week, p_start_time, p_end_time, p_allocation_units
  );
  begin
    insert into public.timetable_slots(school_id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,room,period_id,allocation_units,recurrence_pattern,effective_from,effective_until)
    values(p_school_id,p_teacher_id,p_class_id,p_subject_id,p_day_of_week,p_start_time,p_end_time,nullif(btrim(p_room),''),p_period_id,p_allocation_units,'EVERY_WEEK',v_effective_from,p_effective_until)
    returning * into v_new;
  exception when exclusion_violation then
    get stacked diagnostics v_constraint=constraint_name;
    if v_constraint='excl_teacher_overlap' then raise exception 'TEACHER_CONFLICT';
    elsif v_constraint='excl_class_overlap' then raise exception 'CLASS_CONFLICT';
    elsif v_constraint='excl_room_overlap' then raise exception 'ROOM_CONFLICT';
    else raise exception 'SCHEDULE_CONFLICT'; end if;
  when unique_violation then raise exception 'DUPLICATE_SLOT'; end;
  return v_new;
end;
$$;
-- Retain term-level overrides and use an unambiguous canonical baseline
-- where an assignment has no materialized class-level target.
create or replace function public.get_teacher_weekly_timetable_load()
returns table (
  class_id uuid,
  subject_id uuid,
  class_name text,
  stream text,
  subject_name text,
  grade text,
  lessons_per_week numeric,
  scheduled_count numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_week_start date := date_trunc('week', (now() at time zone 'Africa/Nairobi'))::date;
  v_week_end date := v_week_start + 6;
begin
  if v_teacher_id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  return query
  with assignments as (
    select tc.school_id, tc.class_id, tc.subject_id,
           c.name as c_name, c.stream as c_stream, s.name as s_name,
           case when s.school_id is null then s.id else s.global_subject_id end as global_subject_id
    from public.teacher_classes tc
    join public.classes c on c.id = tc.class_id
    join public.subjects s on s.id = tc.subject_id
    where tc.teacher_id = v_teacher_id
  ),
  term_for_assignment as (
    select a.*,
           t.id as term_id,
           t.start_date as term_start,
           t.end_date as term_end
    from assignments a
    left join lateral (
      select at.*
      from public.academic_terms at
      where at.school_id = a.school_id
        and at.start_date <= v_week_end
        and at.end_date >= v_week_start
      order by
        greatest(0, least(at.end_date, v_week_end) - greatest(at.start_date, v_week_start) + 1) desc,
        at.start_date desc
      limit 1
    ) t on true
  ),
  expected as (
    select a.class_id, a.subject_id,
           coalesce(csa.effective_units_per_week, baseline.units) as units
    from term_for_assignment a
    left join public.class_subject_allocations csa
      on csa.class_id = a.class_id
     and csa.subject_id = a.subject_id
     and csa.academic_term_id = a.term_id
    left join lateral (
      select min(swa.lessons_per_week)::numeric as units
      from public.subject_weekly_allocations swa
      where swa.grade = a.c_name
        and swa.global_subject_id = a.global_subject_id
      having count(*) = 1
    ) baseline on true
  ),
  scheduled as (
    select a.class_id, a.subject_id,
           coalesce(sum(
             ts.allocation_units *
             case
               when ts.recurrence_pattern = 'EVERY_WEEK' then 1::numeric
               else 0.5::numeric
             end
           ), 0)::numeric as units
    from term_for_assignment a
    left join public.timetable_slots ts
      on ts.class_id = a.class_id
     and ts.subject_id = a.subject_id
     and ts.teacher_id = v_teacher_id
     and ts.effective_from <= v_week_end
     and coalesce(ts.effective_until, v_week_end) >= v_week_start
     and ts.effective_from <= (v_week_start + (ts.day_of_week - 1))
     and coalesce(ts.effective_until, (v_week_start + (ts.day_of_week - 1))) >= (v_week_start + (ts.day_of_week - 1))
    group by a.class_id, a.subject_id
  )
  select
    a.class_id,
    a.subject_id,
    a.c_name,
    coalesce(a.c_stream, ''),
    a.s_name,
    a.c_name,
    e.units,
    coalesce(sc.units, 0),
    case
      when a.term_id is null then 'NO_TARGET'
      when e.units is null then 'NO_TARGET'
      when coalesce(sc.units, 0) = 0 then 'ZERO'
      when coalesce(sc.units, 0) < e.units then 'UNDER'
      when coalesce(sc.units, 0) = e.units then 'OK'
      else 'OVER'
    end
  from term_for_assignment a
  left join expected e on e.class_id = a.class_id and e.subject_id = a.subject_id
  left join scheduled sc on sc.class_id = a.class_id and sc.subject_id = a.subject_id
  order by a.c_name, a.c_stream nulls first, a.s_name;
end;
$$;

commit;
