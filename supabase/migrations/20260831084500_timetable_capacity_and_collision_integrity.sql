-- TBL-006 / allocation follow-up
-- Preserve allocation semantics across revisions and expose a bounded
-- forward-collision preview for both teacher self-service and school admins.

-- 1) Canonical weekly load: use effective class+subject+term allocation,
-- allocation_units and recurrence weights. Anchor to the current Nairobi week
-- so superseded mid-term revisions are not double-counted.
drop function if exists public.get_teacher_weekly_timetable_load();

create function public.get_teacher_weekly_timetable_load()
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
           c.name as c_name, c.stream as c_stream, s.name as s_name
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
           csa.effective_units_per_week as units
    from term_for_assignment a
    left join public.class_subject_allocations csa
      on csa.class_id = a.class_id
     and csa.subject_id = a.subject_id
     and csa.academic_term_id = a.term_id
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

revoke all on function public.get_teacher_weekly_timetable_load() from public;
grant execute on function public.get_teacher_weekly_timetable_load() to authenticated;

-- 2) Allocation health: evaluate one representative/anchor week inside the
-- requested term instead of summing every historical revision that overlaps it.
create or replace function public.get_timetable_allocation_health(
  p_class_id uuid,
  p_academic_term_id uuid
) returns table (
  subject_id uuid,
  subject_name text,
  expected_units numeric,
  scheduled_units numeric,
  missing_units numeric,
  excess_units numeric,
  status text,
  allocation_source text,
  is_override boolean,
  assigned_teacher_count integer,
  teacher_assignment_health text
)
language sql
security definer
set search_path = public
stable
as $$
  with ctx as (
    select c.id as class_id, c.school_id, t.start_date, t.end_date,
           case
             when (now() at time zone 'Africa/Nairobi')::date < t.start_date then t.start_date
             when (now() at time zone 'Africa/Nairobi')::date > t.end_date then t.end_date
             else (now() at time zone 'Africa/Nairobi')::date
           end as anchor_date
    from public.classes c
    join public.academic_terms t on t.id = p_academic_term_id and t.school_id = c.school_id
    where c.id = p_class_id
      and public.is_active_school_member(c.school_id)
  ),
  week_ctx as (
    select ctx.*,
           date_trunc('week', anchor_date)::date as week_start,
           date_trunc('week', anchor_date)::date + 6 as week_end
    from ctx
  ),
  allocations as (
    select a.*
    from public.class_subject_allocations a
    join week_ctx on week_ctx.class_id = a.class_id
    where a.academic_term_id = p_academic_term_id
  ),
  scheduled as (
    select ts.subject_id,
      sum(ts.allocation_units * case when ts.recurrence_pattern = 'EVERY_WEEK' then 1::numeric else 0.5::numeric end) as units
    from public.timetable_slots ts
    join week_ctx on week_ctx.class_id = ts.class_id
    where ts.effective_from <= week_ctx.week_end
      and coalesce(ts.effective_until, week_ctx.week_end) >= week_ctx.week_start
      and ts.effective_from <= (week_ctx.week_start + (ts.day_of_week - 1))
      and coalesce(ts.effective_until, (week_ctx.week_start + (ts.day_of_week - 1))) >= (week_ctx.week_start + (ts.day_of_week - 1))
    group by ts.subject_id
  ),
  teachers as (
    select tc.subject_id, count(distinct tc.teacher_id)::integer as teacher_count
    from public.teacher_classes tc
    join week_ctx on week_ctx.class_id = tc.class_id
    group by tc.subject_id
  )
  select
    a.subject_id,
    s.name,
    a.effective_units_per_week,
    coalesce(sc.units,0)::numeric,
    case when a.effective_units_per_week is null then null else greatest(a.effective_units_per_week - coalesce(sc.units,0),0) end,
    case when a.effective_units_per_week is null then null else greatest(coalesce(sc.units,0) - a.effective_units_per_week,0) end,
    case
      when a.effective_units_per_week is null then 'ALLOCATION_UNKNOWN'
      when coalesce(sc.units,0) = 0 then 'UNSCHEDULED'
      when coalesce(sc.units,0) < a.effective_units_per_week then 'UNDER_ALLOCATED'
      when coalesce(sc.units,0) > a.effective_units_per_week then 'OVER_ALLOCATED'
      when coalesce(t.teacher_count,0) = 0 then 'TEACHER_UNASSIGNED'
      when a.is_override then 'OVERRIDE'
      else 'COMPLETE'
    end,
    a.source,
    a.is_override,
    coalesce(t.teacher_count,0),
    case when coalesce(t.teacher_count,0)=0 then 'TEACHER_UNASSIGNED' else 'ASSIGNED' end
  from allocations a
  join public.subjects s on s.id = a.subject_id
  left join scheduled sc on sc.subject_id = a.subject_id
  left join teachers t on t.subject_id = a.subject_id
  order by s.name;
$$;

revoke all on function public.get_timetable_allocation_health(uuid,uuid) from public;
grant execute on function public.get_timetable_allocation_health(uuid,uuid) to authenticated;

-- 3) Forward-collision register. This is a preview/read model; the exclusion
-- constraints remain the final write-time authority. Teachers may preview
-- their own placement; school admins may preview any teacher in their school.
create or replace function public.preview_timetable_conflicts(
  p_school_id uuid,
  p_teacher_id uuid,
  p_class_id uuid,
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_room text default null,
  p_effective_from date default null,
  p_effective_until date default null,
  p_exclude_slot_id uuid default null
) returns table (
  conflict_type text,
  conflicting_slot_id uuid,
  conflicting_teacher_id uuid,
  conflicting_class_id uuid,
  conflicting_subject_id uuid,
  conflicting_room text,
  detail text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_from date := coalesce(p_effective_from, (now() at time zone 'Africa/Nairobi')::date);
  v_until date := coalesce(p_effective_until, 'infinity'::date);
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_active_school_member(p_school_id) then raise exception 'SCHOOL_ACCESS_DENIED'; end if;
  if p_teacher_id is distinct from v_uid and not public.is_school_admin(p_school_id) then
    raise exception 'TIMETABLE_PREVIEW_FORBIDDEN';
  end if;
  if p_day_of_week < 1 or p_day_of_week > 7 then raise exception 'INVALID_DAY'; end if;
  if p_start_time is null or p_end_time is null or p_start_time >= p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_effective_until is not null and p_effective_until < v_from then raise exception 'INVALID_EFFECTIVE_RANGE'; end if;
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.school_id = p_school_id) then
    raise exception 'CLASS_SCHOOL_MISMATCH';
  end if;

  return query
  select
    case
      when ts.teacher_id = p_teacher_id then 'TEACHER_CONFLICT'
      when ts.class_id = p_class_id then 'CLASS_CONFLICT'
      when p_room is not null and ts.room = nullif(btrim(p_room),'') then 'ROOM_CONFLICT'
      else 'SCHEDULE_CONFLICT'
    end,
    ts.id,
    ts.teacher_id,
    ts.class_id,
    ts.subject_id,
    ts.room,
    case
      when ts.teacher_id = p_teacher_id then 'Teacher already has an overlapping lesson in this effective date range.'
      when ts.class_id = p_class_id then 'Class already has an overlapping lesson in this effective date range.'
      else 'Room already has an overlapping lesson in this effective date range.'
    end
  from public.timetable_slots ts
  where ts.school_id = p_school_id
    and ts.id is distinct from p_exclude_slot_id
    and ts.day_of_week = p_day_of_week
    and ts.start_time < p_end_time
    and ts.end_time > p_start_time
    and ts.effective_from <= v_until
    and coalesce(ts.effective_until, 'infinity'::date) >= v_from
    and (
      ts.teacher_id = p_teacher_id
      or ts.class_id = p_class_id
      or (p_room is not null and nullif(btrim(p_room),'') is not null and ts.room = nullif(btrim(p_room),''))
    )
  order by conflict_type, ts.start_time, ts.id;
end;
$$;

revoke all on function public.preview_timetable_conflicts(uuid,uuid,uuid,integer,time,time,text,date,date,uuid) from public;
grant execute on function public.preview_timetable_conflicts(uuid,uuid,uuid,integer,time,time,text,date,date,uuid) to authenticated;

-- 4) Preserve complex-slot semantics through timetable duplication.
create or replace function public.duplicate_active_timetable(p_effective_from date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid:=auth.uid(); v_today date:=(now() at time zone 'Africa/Nairobi')::date; v_count integer;
begin
 if v_uid is null then raise exception 'not_authenticated'; end if;
 if p_effective_from is null or p_effective_from<v_today then raise exception 'invalid_date'; end if;
 perform pg_advisory_xact_lock(hashtextextended('timetable_duplicate:'||v_uid::text||':'||p_effective_from::text,0));
 if exists(select 1 from timetable_slots s where s.teacher_id=v_uid and s.effective_from>=p_effective_from) then raise exception 'future_revision_exists'; end if;
 update timetable_slots set effective_until=p_effective_from-1,updated_at=clock_timestamp() where teacher_id=v_uid and effective_from<p_effective_from and (effective_until is null or effective_until>=p_effective_from);
 insert into timetable_slots(school_id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,room,period_id,allocation_units,recurrence_pattern,effective_from,effective_until)
 select school_id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,room,period_id,allocation_units,recurrence_pattern,p_effective_from,null from timetable_slots where teacher_id=v_uid and effective_until=p_effective_from-1;
 get diagnostics v_count=row_count; return v_count;
end;
$$;

-- 5) Preserve complex-slot semantics in snapshots and restores.
create or replace function public.snapshot_timetable(p_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_school uuid;
  v_slots jsonb;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if nullif(btrim(p_label), '') is null then raise exception 'label_required'; end if;
  select tc.school_id into v_school from teacher_classes tc where tc.teacher_id = v_uid limit 1;
  if v_school is null then raise exception 'school_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', s.class_id, 'subject_id', s.subject_id,
    'day_of_week', s.day_of_week, 'start_time', s.start_time,
    'end_time', s.end_time, 'room', s.room, 'period_id', s.period_id,
    'allocation_units', s.allocation_units, 'recurrence_pattern', s.recurrence_pattern
  )), '[]'::jsonb) into v_slots
  from timetable_slots s
  where s.teacher_id = v_uid
    and (s.effective_until is null or s.effective_until >= v_today);
  if v_slots = '[]'::jsonb then raise exception 'nothing_to_snapshot'; end if;

  insert into timetable_snapshots (school_id, teacher_id, label, slots)
  values (v_school, v_uid, btrim(p_label), v_slots)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.restore_timetable_snapshot(p_snapshot_id uuid, p_effective_from date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_snap public.timetable_snapshots;
  v_count integer := 0;
  v_row jsonb;
  v_constraint text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_snap from timetable_snapshots where id = p_snapshot_id;
  if v_snap.id is null then raise exception 'snapshot_not_found'; end if;
  if v_snap.teacher_id <> v_uid then raise exception 'snapshot_not_owned'; end if;
  if p_effective_from is null or p_effective_from < v_today then raise exception 'invalid_date'; end if;

  if exists (
    select 1 from timetable_slots s
    join teaching_occurrences o on o.timetable_slot_id = s.id
    where s.teacher_id = v_uid and s.effective_from >= p_effective_from
      and o.lifecycle in ('in_progress','completed')
  ) then raise exception 'future_slot_has_occurrences'; end if;

  update teaching_occurrences o
     set lifecycle = 'cancelled', cancelled_at = clock_timestamp(),
         cancelled_reason = 'snapshot_restored'
    from timetable_slots s
   where o.timetable_slot_id = s.id and s.teacher_id = v_uid
     and o.lifecycle in ('planned','ready')
     and o.occurrence_date >= p_effective_from;

  delete from timetable_slots s
   where s.teacher_id = v_uid and s.effective_from >= p_effective_from
     and not exists (select 1 from teaching_occurrences o where o.timetable_slot_id = s.id);

  update timetable_slots
     set effective_until = p_effective_from - 1, updated_at = clock_timestamp()
   where teacher_id = v_uid
     and effective_from < p_effective_from
     and (effective_until is null or effective_until >= p_effective_from);

  begin
    for v_row in select * from jsonb_array_elements(v_snap.slots) loop
      insert into timetable_slots
        (school_id, teacher_id, class_id, subject_id, day_of_week,
         start_time, end_time, room, period_id, allocation_units,
         recurrence_pattern, effective_from, effective_until)
      values (
        v_snap.school_id, v_uid,
        (v_row->>'class_id')::uuid, (v_row->>'subject_id')::uuid,
        (v_row->>'day_of_week')::integer,
        (v_row->>'start_time')::time, (v_row->>'end_time')::time,
        nullif(v_row->>'room',''), nullif(v_row->>'period_id','')::uuid,
        coalesce(nullif(v_row->>'allocation_units','')::numeric, 1),
        coalesce(nullif(v_row->>'recurrence_pattern',''), 'EVERY_WEEK'),
        p_effective_from, null
      );
      v_count := v_count + 1;
    end loop;
  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'excl_teacher_overlap' then raise exception 'TEACHER_CONFLICT';
      elsif v_constraint = 'excl_class_overlap' then raise exception 'CLASS_CONFLICT';
      elsif v_constraint = 'excl_room_overlap' then raise exception 'ROOM_CONFLICT';
      else raise exception 'SCHEDULE_CONFLICT'; end if;
  end;
  return v_count;
end;
$$;
