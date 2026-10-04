begin;

-- Timetable modernization closure.
-- The earlier modern_timetable_operations migration supplies the base
-- calendar/availability/resource/release objects. This migration closes the
-- remaining authority, multi-school, plan-first and undo/repeat gaps.

-- Allow multiple named events of the same kind on one date.
alter table public.school_calendar_exceptions
  drop constraint if exists school_calendar_exceptions_school_id_exception_date_kind_key;
alter table public.school_calendar_exceptions
  drop constraint if exists school_calendar_exceptions_school_id_exception_date_kind_label_key;
alter table public.school_calendar_exceptions
  add constraint school_calendar_exceptions_school_id_exception_date_kind_label_key
  unique (school_id,exception_date,kind,label);

-- Self-service availability and absence writes must still be backed by a
-- current teacher membership in that school.
drop policy if exists teacher_availability_self_write on public.teacher_timetable_availability;
drop policy if exists teacher_timetable_availability_write on public.teacher_timetable_availability;
create policy teacher_timetable_availability_write on public.teacher_timetable_availability
for all to authenticated
using (teacher_id=(select auth.uid()) or public.is_school_admin(school_id))
with check (
  (teacher_id=(select auth.uid()) and exists (
    select 1 from public.school_members sm
    where sm.school_id=teacher_timetable_availability.school_id
      and sm.profile_id=(select auth.uid())
      and sm.role::text='teacher'
  ))
  or public.is_school_admin(school_id)
);

drop policy if exists teacher_absence_admin_write on public.teacher_absences;
drop policy if exists teacher_absence_write on public.teacher_absences;
create policy teacher_absence_write on public.teacher_absences
for all to authenticated
using (teacher_id=(select auth.uid()) or public.is_school_admin(school_id))
with check (
  (teacher_id=(select auth.uid()) and exists (
    select 1 from public.school_members sm
    where sm.school_id=teacher_absences.school_id
      and sm.profile_id=(select auth.uid())
      and sm.role::text='teacher'
  ))
  or public.is_school_admin(school_id)
);

-- Per-class duration and day-part preferences are advisory. school_periods
-- remains the canonical bell-time authority.
create table if not exists public.class_timetable_preferences (
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_minutes integer not null check (lesson_minutes between 20 and 120),
  preferred_day_part text check (preferred_day_part is null or preferred_day_part in ('morning','afternoon')),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (school_id,class_id)
);
alter table public.class_timetable_preferences enable row level security;
revoke all on table public.class_timetable_preferences from public, anon;
grant select,insert,update,delete on table public.class_timetable_preferences to authenticated;
grant all on table public.class_timetable_preferences to service_role;

drop policy if exists class_timetable_preferences_member_read on public.class_timetable_preferences;
create policy class_timetable_preferences_member_read on public.class_timetable_preferences
for select to authenticated using (public.is_active_school_member(school_id));

drop policy if exists class_timetable_preferences_admin_write on public.class_timetable_preferences;
create policy class_timetable_preferences_admin_write on public.class_timetable_preferences
for all to authenticated
using (public.is_school_admin(school_id))
with check (
  public.is_school_admin(school_id)
  and exists (
    select 1 from public.classes c
    where c.id=class_id and c.school_id=school_id
  )
);

-- Plan-first workflow. Unscheduled plans are private drafts only; anything
-- publishable/teachable must first attach to a real timetable occurrence.
alter table public.lesson_plans alter column timetable_slot_id drop not null;
alter table public.lesson_plans drop constraint if exists lesson_plans_unscheduled_draft_only;
alter table public.lesson_plans add constraint lesson_plans_unscheduled_draft_only
  check (timetable_slot_id is not null or status='draft') not valid;
alter table public.lesson_plans validate constraint lesson_plans_unscheduled_draft_only;

create unique index if not exists uq_lesson_plans_unscheduled_teacher_class_subject_date
  on public.lesson_plans(teacher_id,class_id,subject_id,taught_date)
  where timetable_slot_id is null;

create or replace function public.create_independent_lesson_plan(
  p_class_id uuid,
  p_subject_id uuid,
  p_planned_date date,
  p_topic text,
  p_title text,
  p_body text default null,
  p_duration_minutes integer default null,
  p_scheme_id uuid default null
) returns public.lesson_plans
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_school uuid;
  v_week_start date;
  v_day integer;
  v_row public.lesson_plans;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_class_id is null or p_subject_id is null then raise exception 'INVALID_ASSIGNMENT'; end if;
  if p_planned_date is null then raise exception 'INVALID_DATE'; end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null
     and nullif(btrim(coalesce(p_body,'')),'') is null then
    raise exception 'LESSON_CONTENT_REQUIRED';
  end if;
  if p_duration_minutes is not null and (p_duration_minutes<20 or p_duration_minutes>240) then
    raise exception 'INVALID_DURATION';
  end if;

  select tc.school_id into v_school
  from public.teacher_classes tc
  join public.school_members sm
    on sm.school_id=tc.school_id
   and sm.profile_id=tc.teacher_id
   and sm.role::text='teacher'
  where tc.teacher_id=v_uid
    and tc.class_id=p_class_id
    and tc.subject_id=p_subject_id
  limit 1;
  if v_school is null then raise exception 'INVALID_ASSIGNMENT'; end if;

  if p_scheme_id is not null and not exists (
    select 1 from public.scheme_of_work sw
    where sw.id=p_scheme_id
      and sw.teacher_id=v_uid
      and sw.class_id=p_class_id
      and sw.subject_id=p_subject_id
  ) then
    raise exception 'SCHEME_MISMATCH';
  end if;

  v_day:=extract(isodow from p_planned_date)::integer;
  v_week_start:=p_planned_date-(v_day-1);

  insert into public.lesson_plans(
    school_id,teacher_id,class_id,subject_id,timetable_slot_id,
    week_start,day_of_week,taught_date,topic,title,body,status,generated_by,
    duration_minutes,scheme_id
  ) values (
    v_school,v_uid,p_class_id,p_subject_id,null,
    v_week_start,v_day,p_planned_date,nullif(btrim(coalesce(p_topic,'')),''),
    nullif(btrim(coalesce(p_title,'')),''),
    nullif(btrim(coalesce(p_body,'')),''),
    'draft','manual',coalesce(p_duration_minutes,40),p_scheme_id
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.create_independent_lesson_plan(uuid,uuid,date,text,text,text,integer,uuid) from public,anon;
grant execute on function public.create_independent_lesson_plan(uuid,uuid,date,text,text,text,integer,uuid) to authenticated;

create or replace function public.attach_independent_lesson_plan(
  p_lesson_plan_id uuid,
  p_timetable_slot_id uuid,
  p_taught_date date
) returns public.lesson_plans
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_plan public.lesson_plans;
  v_slot public.timetable_slots;
  v_day integer;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_plan
  from public.lesson_plans
  where id=p_lesson_plan_id and teacher_id=v_uid
  for update;

  if v_plan.id is null then raise exception 'LESSON_PLAN_NOT_FOUND'; end if;
  if v_plan.timetable_slot_id is not null then raise exception 'LESSON_PLAN_ALREADY_SCHEDULED'; end if;
  if v_plan.status<>'draft' then raise exception 'LESSON_PLAN_NOT_DRAFT'; end if;

  select * into v_slot
  from public.timetable_slots
  where id=p_timetable_slot_id and teacher_id=v_uid;

  if v_slot.id is null then raise exception 'TIMETABLE_SLOT_NOT_FOUND'; end if;
  if v_slot.school_id is distinct from v_plan.school_id
     or v_slot.class_id is distinct from v_plan.class_id
     or v_slot.subject_id is distinct from v_plan.subject_id then
    raise exception 'LESSON_PLAN_SLOT_MISMATCH';
  end if;

  if p_taught_date is null
     or p_taught_date<v_slot.effective_from
     or (v_slot.effective_until is not null and p_taught_date>v_slot.effective_until) then
    raise exception 'INVALID_DATE';
  end if;

  v_day:=extract(isodow from p_taught_date)::integer;
  if v_day<>v_slot.day_of_week then
    raise exception 'LESSON_PLAN_SLOT_DATE_MISMATCH';
  end if;

  update public.lesson_plans
  set timetable_slot_id=v_slot.id,
      taught_date=p_taught_date,
      day_of_week=v_slot.day_of_week,
      week_start=p_taught_date-(v_slot.day_of_week-1),
      updated_at=clock_timestamp()
  where id=v_plan.id
  returning * into v_plan;

  return v_plan;
end;
$$;
revoke all on function public.attach_independent_lesson_plan(uuid,uuid,date) from public,anon;
grant execute on function public.attach_independent_lesson_plan(uuid,uuid,date) to authenticated;

-- Preview must tell the same truth as the exclusion constraints: teacher
-- overlap is cross-school; class and room overlap stay school-scoped.
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
) returns table(
  conflict_type text,
  conflicting_slot_id uuid,
  conflicting_teacher_id uuid,
  conflicting_class_id uuid,
  conflicting_subject_id uuid,
  conflicting_room text,
  detail text
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_from date:=coalesce(p_effective_from,(now() at time zone 'Africa/Nairobi')::date);
  v_until date:=coalesce(p_effective_until,'infinity'::date);
  v_is_admin boolean:=false;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_active_school_member(p_school_id) then raise exception 'SCHOOL_ACCESS_DENIED'; end if;
  v_is_admin:=public.is_school_admin(p_school_id);
  if p_teacher_id is distinct from v_uid and not v_is_admin then
    raise exception 'TIMETABLE_PREVIEW_FORBIDDEN';
  end if;
  if p_day_of_week is null or p_day_of_week<1 or p_day_of_week>7 then raise exception 'INVALID_DAY'; end if;
  if p_start_time is null or p_end_time is null or p_start_time>=p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if p_effective_until is not null and p_effective_until<v_from then raise exception 'INVALID_EFFECTIVE_RANGE'; end if;
  if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=p_school_id) then
    raise exception 'CLASS_SCHOOL_MISMATCH';
  end if;

  return query
  select
    case
      when ts.teacher_id=p_teacher_id then 'TEACHER_CONFLICT'
      when ts.class_id=p_class_id then 'CLASS_CONFLICT'
      when p_room is not null and ts.room=nullif(btrim(p_room),'') then 'ROOM_CONFLICT'
      else 'SCHEDULE_CONFLICT'
    end,
    ts.id,
    case when v_is_admin or ts.teacher_id=v_uid then ts.teacher_id else null end,
    ts.class_id,
    ts.subject_id,
    ts.room,
    case
      when ts.teacher_id=p_teacher_id and ts.school_id<>p_school_id
        then 'Teacher already has an overlapping lesson at another school.'
      when ts.teacher_id=p_teacher_id
        then 'Teacher already has an overlapping lesson in this effective date range.'
      when ts.class_id=p_class_id
        then 'Class already has an overlapping lesson in this effective date range.'
      else 'Room already has an overlapping lesson in this effective date range.'
    end
  from public.timetable_slots ts
  where ts.id is distinct from p_exclude_slot_id
    and ts.day_of_week=p_day_of_week
    and ts.start_time<p_end_time
    and ts.end_time>p_start_time
    and ts.effective_from<=v_until
    and coalesce(ts.effective_until,'infinity'::date)>=v_from
    and (
      ts.teacher_id=p_teacher_id
      or (
        ts.school_id=p_school_id
        and (
          ts.class_id=p_class_id
          or (
            p_room is not null
            and nullif(btrim(p_room),'') is not null
            and ts.room=nullif(btrim(p_room),'')
          )
        )
      )
    )
  order by conflict_type,ts.start_time,ts.id;
end;
$$;
revoke all on function public.preview_timetable_conflicts(uuid,uuid,uuid,integer,time,time,text,date,date,uuid) from public,anon;
grant execute on function public.preview_timetable_conflicts(uuid,uuid,uuid,integer,time,time,text,date,date,uuid) to authenticated;

-- Snapshots are an all-school teacher safety net. Store school identity and
-- effective range per slot so undo cannot collapse a multi-school teacher into
-- whichever school happened to be selected.
create or replace function public.snapshot_timetable(p_label text)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_today date:=(now() at time zone 'Africa/Nairobi')::date;
  v_school uuid;
  v_slots jsonb;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if nullif(btrim(p_label),'') is null then raise exception 'label_required'; end if;

  select pref.school_id into v_school
  from public.teacher_active_school_preferences pref
  join public.school_members sm
    on sm.school_id=pref.school_id
   and sm.profile_id=v_uid
   and sm.role::text='teacher'
  where pref.teacher_id=v_uid
  limit 1;

  if v_school is null then
    select sm.school_id into v_school
    from public.school_members sm
    where sm.profile_id=v_uid and sm.role::text='teacher'
    order by sm.school_id
    limit 1;
  end if;
  if v_school is null then raise exception 'school_not_found'; end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'school_id',s.school_id,
        'class_id',s.class_id,
        'subject_id',s.subject_id,
        'day_of_week',s.day_of_week,
        'start_time',s.start_time,
        'end_time',s.end_time,
        'room',s.room,
        'period_id',s.period_id,
        'allocation_units',s.allocation_units,
        'recurrence_pattern',s.recurrence_pattern,
        'effective_from',s.effective_from,
        'effective_until',s.effective_until
      )
      order by s.school_id,s.day_of_week,s.start_time,s.id
    ),
    '[]'::jsonb
  )
  into v_slots
  from public.timetable_slots s
  where s.teacher_id=v_uid
    and (s.effective_until is null or s.effective_until>=v_today);

  insert into public.timetable_snapshots(school_id,teacher_id,label,slots)
  values(v_school,v_uid,btrim(p_label),v_slots)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.snapshot_timetable(text) from public,anon;
grant execute on function public.snapshot_timetable(text) to authenticated;

create or replace function public.restore_timetable_snapshot(
  p_snapshot_id uuid,
  p_effective_from date
) returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_today date:=(now() at time zone 'Africa/Nairobi')::date;
  v_snap public.timetable_snapshots;
  v_count integer:=0;
  v_row jsonb;
  v_school uuid;
  v_class uuid;
  v_subject uuid;
  v_period uuid;
  v_start date;
  v_until date;
  v_constraint text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_snap
  from public.timetable_snapshots
  where id=p_snapshot_id;

  if v_snap.id is null then raise exception 'snapshot_not_found'; end if;
  if v_snap.teacher_id<>v_uid then raise exception 'snapshot_not_owned'; end if;
  if p_effective_from is null or p_effective_from<v_today then raise exception 'invalid_date'; end if;

  if exists (
    select 1
    from public.timetable_slots s
    join public.teaching_occurrences o on o.timetable_slot_id=s.id
    where s.teacher_id=v_uid
      and s.effective_from>=p_effective_from
      and o.lifecycle in ('in_progress','completed')
  ) then
    raise exception 'future_slot_has_occurrences';
  end if;

  update public.teaching_occurrences o
  set lifecycle='cancelled',
      cancelled_at=clock_timestamp(),
      cancelled_reason='snapshot_restored'
  from public.timetable_slots s
  where o.timetable_slot_id=s.id
    and s.teacher_id=v_uid
    and o.lifecycle in ('planned','ready')
    and o.occurrence_date>=p_effective_from;

  delete from public.timetable_slots s
  where s.teacher_id=v_uid
    and s.effective_from>=p_effective_from
    and not exists (
      select 1 from public.teaching_occurrences o
      where o.timetable_slot_id=s.id
    );

  update public.timetable_slots
  set effective_until=p_effective_from-1,
      updated_at=clock_timestamp()
  where teacher_id=v_uid
    and effective_from<p_effective_from
    and (effective_until is null or effective_until>=p_effective_from);

  begin
    for v_row in select * from jsonb_array_elements(v_snap.slots) loop
      v_school:=(v_row->>'school_id')::uuid;
      v_class:=(v_row->>'class_id')::uuid;
      v_subject:=(v_row->>'subject_id')::uuid;
      v_period:=nullif(v_row->>'period_id','')::uuid;
      v_start:=greatest(
        coalesce(nullif(v_row->>'effective_from','')::date,p_effective_from),
        p_effective_from
      );
      v_until:=nullif(v_row->>'effective_until','')::date;

      if v_until is not null and v_until<p_effective_from then
        continue;
      end if;

      if not exists (
        select 1 from public.school_members sm
        where sm.school_id=v_school
          and sm.profile_id=v_uid
          and sm.role::text='teacher'
      ) then
        raise exception 'school_not_found';
      end if;

      if not exists (
        select 1 from public.teacher_classes tc
        where tc.teacher_id=v_uid
          and tc.school_id=v_school
          and tc.class_id=v_class
          and tc.subject_id=v_subject
      ) then
        raise exception 'assignment_not_found';
      end if;

      if v_period is not null and not exists (
        select 1 from public.school_periods sp
        where sp.id=v_period and sp.school_id=v_school
      ) then
        v_period:=null;
      end if;

      insert into public.timetable_slots(
        school_id,teacher_id,class_id,subject_id,day_of_week,
        start_time,end_time,room,period_id,allocation_units,
        recurrence_pattern,effective_from,effective_until
      ) values (
        v_school,v_uid,v_class,v_subject,
        (v_row->>'day_of_week')::integer,
        (v_row->>'start_time')::time,
        (v_row->>'end_time')::time,
        nullif(v_row->>'room',''),
        v_period,
        coalesce(nullif(v_row->>'allocation_units','')::numeric,1),
        coalesce(nullif(v_row->>'recurrence_pattern',''),'EVERY_WEEK'),
        v_start,
        v_until
      );
      v_count:=v_count+1;
    end loop;
  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint=constraint_name;
      if v_constraint='excl_teacher_overlap' then raise exception 'TEACHER_CONFLICT';
      elsif v_constraint='excl_class_overlap' then raise exception 'CLASS_CONFLICT';
      elsif v_constraint='excl_room_overlap' then raise exception 'ROOM_CONFLICT';
      else raise exception 'SCHEDULE_CONFLICT';
      end if;
  end;

  return v_count;
end;
$$;
revoke all on function public.restore_timetable_snapshot(uuid,date) from public,anon;
grant execute on function public.restore_timetable_snapshot(uuid,date) to authenticated;

-- Harden substitution/absence/release writers with explicit auth checks and
-- ensure suggestions use cross-school teacher conflict truth.
create or replace function public.assign_occurrence_substitute(
  p_occurrence_id uuid,
  p_substitute_teacher_id uuid,
  p_reason text
) returns public.teaching_occurrences
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v public.teaching_occurrences;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v
  from public.teaching_occurrences
  where id=p_occurrence_id
  for update;

  if v.id is null then raise exception 'OCCURRENCE_NOT_FOUND'; end if;
  if not public.is_school_admin(v.school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
  if v.lifecycle in ('completed','cancelled','rescheduled') then raise exception 'OCCURRENCE_LOCKED'; end if;

  if not exists (
    select 1 from public.school_members sm
    where sm.school_id=v.school_id
      and sm.profile_id=p_substitute_teacher_id
      and sm.role::text='teacher'
  ) then
    raise exception 'SUBSTITUTE_NOT_SCHOOL_TEACHER';
  end if;

  if exists (
    select 1
    from public.teaching_occurrences o
    join public.timetable_slots s on s.id=o.timetable_slot_id
    join public.timetable_slots target on target.id=v.timetable_slot_id
    where coalesce(o.actual_teacher_id,o.teacher_id)=p_substitute_teacher_id
      and o.occurrence_date=v.occurrence_date
      and o.id<>v.id
      and o.lifecycle not in ('cancelled','rescheduled')
      and s.start_time<target.end_time
      and s.end_time>target.start_time
  ) then
    raise exception 'SUBSTITUTE_CONFLICT';
  end if;

  update public.teaching_occurrences
  set actual_teacher_id=p_substitute_teacher_id,
      exception_reason=nullif(btrim(coalesce(p_reason,'')),'')
  where id=v.id
  returning * into v;

  return v;
end;
$$;
revoke all on function public.assign_occurrence_substitute(uuid,uuid,text) from public,anon;
grant execute on function public.assign_occurrence_substitute(uuid,uuid,text) to authenticated;

create or replace function public.apply_teacher_absence(p_absence_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  a public.teacher_absences;
  n integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into a
  from public.teacher_absences
  where id=p_absence_id;

  if a.id is null then raise exception 'ABSENCE_NOT_FOUND'; end if;
  if auth.uid()<>a.teacher_id and not public.is_school_admin(a.school_id) then
    raise exception 'ABSENCE_ACCESS_DENIED';
  end if;

  update public.teaching_occurrences o
  set exception_reason=coalesce(nullif(btrim(a.reason),''),'Teacher absent')
  from public.timetable_slots s
  where o.timetable_slot_id=s.id
    and o.teacher_id=a.teacher_id
    and o.school_id=a.school_id
    and o.lifecycle in ('planned','ready')
    and (o.occurrence_date+s.start_time) at time zone 'Africa/Nairobi'<a.ends_at
    and (o.occurrence_date+s.end_time) at time zone 'Africa/Nairobi'>a.starts_at;

  get diagnostics n=row_count;
  return n;
end;
$$;
revoke all on function public.apply_teacher_absence(uuid) from public,anon;
grant execute on function public.apply_teacher_absence(uuid) to authenticated;

create or replace function public.attach_active_slots_to_release(p_release_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v public.timetable_releases;
  n integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v
  from public.timetable_releases
  where id=p_release_id;

  if v.id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if not public.is_school_admin(v.school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
  if v.status<>'draft' then raise exception 'RELEASE_NOT_DRAFT'; end if;

  update public.timetable_slots
  set release_id=v.id
  where school_id=v.school_id
    and effective_from<=v.effective_from
    and coalesce(effective_until,v.effective_from)>=v.effective_from
    and release_id is null;

  get diagnostics n=row_count;
  return n;
end;
$$;
revoke all on function public.attach_active_slots_to_release(uuid) from public,anon;
grant execute on function public.attach_active_slots_to_release(uuid) to authenticated;

create or replace function public.suggest_school_timetable_candidates(
  p_school_id uuid,
  p_class_id uuid,
  p_subject_id uuid,
  p_teacher_id uuid,
  p_effective_on date default null
) returns table(
  day_of_week integer,
  period_id uuid,
  start_time time,
  end_time time,
  score integer,
  explanation text
)
language sql
security definer
stable
set search_path=public,pg_temp
as $$
with ctx as (
  select coalesce(p_effective_on,(now() at time zone 'Africa/Nairobi')::date) d
),
days as (
  select generate_series(1,5)::int dow
),
candidates as (
  select d.dow,sp.id period_id,sp.start_time,sp.end_time
  from days d
  cross join public.school_periods sp
  cross join ctx
  where sp.school_id=p_school_id
    and sp.kind='lesson'
    and public.is_school_admin(p_school_id)
    and not exists (
      select 1 from public.teacher_timetable_availability ta
      where ta.school_id=p_school_id
        and ta.teacher_id=p_teacher_id
        and ta.day_of_week=d.dow
        and ta.availability='unavailable'
        and ta.start_time<sp.end_time
        and ta.end_time>sp.start_time
        and ta.effective_from<=ctx.d
        and coalesce(ta.effective_until,ctx.d)>=ctx.d
    )
    and not exists (
      select 1 from public.timetable_slots ts
      where ts.day_of_week=d.dow
        and ts.start_time<sp.end_time
        and ts.end_time>sp.start_time
        and (
          ts.teacher_id=p_teacher_id
          or (ts.school_id=p_school_id and ts.class_id=p_class_id)
        )
        and ts.effective_from<=ctx.d
        and coalesce(ts.effective_until,ctx.d)>=ctx.d
    )
),
scored as (
  select c.*,
    (
      case
        when r.preferred_day_part='morning' and c.start_time<'12:00' then 20
        when r.preferred_day_part='afternoon' and c.start_time>='12:00' then 20
        else 0
      end
      +
      case
        when cp.preferred_day_part='morning' and c.start_time<'12:00' then 10
        when cp.preferred_day_part='afternoon' and c.start_time>='12:00' then 10
        else 0
      end
      -
      2*(
        select count(*)
        from public.timetable_slots ts
        cross join ctx
        where ts.teacher_id=p_teacher_id
          and ts.day_of_week=c.dow
          and ts.effective_from<=ctx.d
          and coalesce(ts.effective_until,ctx.d)>=ctx.d
      )::int
    ) score
  from candidates c
  left join public.subject_timetable_rules r
    on r.school_id=p_school_id
   and r.class_id=p_class_id
   and r.subject_id=p_subject_id
  left join public.class_timetable_preferences cp
    on cp.school_id=p_school_id
   and cp.class_id=p_class_id
)
select
  dow,
  period_id,
  start_time,
  end_time,
  score,
  case
    when score>=20 then 'Preferred teaching time; no hard conflict.'
    else 'No hard conflict; ranked by teacher daily load.'
  end
from scored
order by score desc,dow,start_time;
$$;
revoke all on function public.suggest_school_timetable_candidates(uuid,uuid,uuid,uuid,date) from public,anon;
grant execute on function public.suggest_school_timetable_candidates(uuid,uuid,uuid,uuid,date) to authenticated;

commit;
