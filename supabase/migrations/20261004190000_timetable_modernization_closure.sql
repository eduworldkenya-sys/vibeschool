begin;

-- Timetable modernization closure.
-- Adds independent lesson preparation, grade-aware duration defaults,
-- school calendar/absence/substitution authority, and multi-school-safe undo.

create table if not exists public.lesson_plan_drafts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  scheme_id uuid references public.scheme_of_work(id) on delete set null,
  curriculum_id uuid references public.curriculum(id) on delete set null,
  strand_id uuid references public.cbc_strands(id) on delete set null,
  title text,
  topic text,
  body text,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 10 and 240),
  status text not null default 'draft' check (status in ('draft','ready','archived')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (nullif(btrim(coalesce(title,'')),'') is not null or nullif(btrim(coalesce(body,'')),'') is not null)
);

create index if not exists idx_lesson_plan_drafts_teacher
  on public.lesson_plan_drafts(teacher_id, updated_at desc);
create index if not exists idx_lesson_plan_drafts_context
  on public.lesson_plan_drafts(school_id, class_id, subject_id, updated_at desc);

alter table public.lesson_plan_drafts enable row level security;
revoke all on table public.lesson_plan_drafts from public, anon, authenticated;
grant select, insert, update, delete on table public.lesson_plan_drafts to authenticated;
grant all on table public.lesson_plan_drafts to service_role;

drop policy if exists lesson_plan_drafts_teacher_select on public.lesson_plan_drafts;
create policy lesson_plan_drafts_teacher_select
on public.lesson_plan_drafts for select to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.school_members sm
    where sm.school_id = lesson_plan_drafts.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role::text = 'teacher'
  )
);

drop policy if exists lesson_plan_drafts_teacher_insert on public.lesson_plan_drafts;
create policy lesson_plan_drafts_teacher_insert
on public.lesson_plan_drafts for insert to authenticated
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.school_members sm
    where sm.school_id = lesson_plan_drafts.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role::text = 'teacher'
  )
);

drop policy if exists lesson_plan_drafts_teacher_update on public.lesson_plan_drafts;
create policy lesson_plan_drafts_teacher_update
on public.lesson_plan_drafts for update to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.school_members sm
    where sm.school_id = lesson_plan_drafts.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role::text = 'teacher'
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.school_members sm
    where sm.school_id = lesson_plan_drafts.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role::text = 'teacher'
  )
);

drop policy if exists lesson_plan_drafts_teacher_delete on public.lesson_plan_drafts;
create policy lesson_plan_drafts_teacher_delete
on public.lesson_plan_drafts for delete to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.school_members sm
    where sm.school_id = lesson_plan_drafts.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role::text = 'teacher'
  )
);

create or replace function public.attach_lesson_plan_draft_to_occurrence(
  p_draft_id uuid,
  p_timetable_slot_id uuid,
  p_taught_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_draft public.lesson_plan_drafts;
  v_slot public.timetable_slots;
  v_existing uuid;
  v_plan_id uuid;
  v_week_start date;
  v_iso_dow integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_taught_date is null then
    raise exception 'INVALID_TAUGHT_DATE';
  end if;

  select * into v_draft
  from public.lesson_plan_drafts
  where id = p_draft_id and teacher_id = v_uid
  for update;
  if v_draft.id is null then
    raise exception 'DRAFT_NOT_FOUND';
  end if;
  if v_draft.status = 'archived' then
    raise exception 'DRAFT_ARCHIVED';
  end if;

  select * into v_slot
  from public.timetable_slots
  where id = p_timetable_slot_id and teacher_id = v_uid;
  if v_slot.id is null then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  if v_draft.school_id <> v_slot.school_id then
    raise exception 'DRAFT_SCHOOL_MISMATCH';
  end if;
  if v_draft.subject_id <> v_slot.subject_id then
    raise exception 'DRAFT_SUBJECT_MISMATCH';
  end if;
  if v_draft.class_id is not null and v_draft.class_id <> v_slot.class_id then
    raise exception 'DRAFT_CLASS_MISMATCH';
  end if;

  v_iso_dow := extract(isodow from p_taught_date)::integer;
  if v_iso_dow <> v_slot.day_of_week
     or p_taught_date < v_slot.effective_from
     or (v_slot.effective_until is not null and p_taught_date > v_slot.effective_until) then
    raise exception 'DRAFT_OCCURRENCE_MISMATCH';
  end if;

  select lp.id into v_existing
  from public.lesson_plans lp
  where lp.teacher_id = v_uid
    and lp.timetable_slot_id = p_timetable_slot_id
    and lp.taught_date = p_taught_date
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  v_week_start := p_taught_date - (v_iso_dow - 1);

  insert into public.lesson_plans (
    school_id, teacher_id, class_id, subject_id, timetable_slot_id,
    week_start, day_of_week, taught_date, title, topic, body,
    generated_by, duration_minutes, status, scheme_id, curriculum_id, strand_id
  )
  values (
    v_slot.school_id, v_uid, v_slot.class_id, v_slot.subject_id, v_slot.id,
    v_week_start, v_slot.day_of_week, p_taught_date,
    coalesce(v_draft.title, v_draft.topic, 'Prepared lesson'),
    v_draft.topic, v_draft.body, 'manual', v_draft.duration_minutes, 'draft',
    v_draft.scheme_id, v_draft.curriculum_id, v_draft.strand_id
  )
  returning id into v_plan_id;

  return v_plan_id;
end;
$function$;

revoke all on function public.attach_lesson_plan_draft_to_occurrence(uuid,uuid,date)
  from public, anon, authenticated;
grant execute on function public.attach_lesson_plan_draft_to_occurrence(uuid,uuid,date)
  to authenticated;

create table if not exists public.school_lesson_duration_defaults (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade_label text not null check (length(btrim(grade_label)) between 1 and 80),
  duration_minutes integer not null check (duration_minutes between 20 and 120),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (school_id, grade_label)
);

alter table public.school_lesson_duration_defaults enable row level security;
revoke all on table public.school_lesson_duration_defaults from public, anon, authenticated;
grant select on table public.school_lesson_duration_defaults to authenticated;
grant insert, update, delete on table public.school_lesson_duration_defaults to authenticated;
grant all on table public.school_lesson_duration_defaults to service_role;

drop policy if exists school_lesson_duration_member_read on public.school_lesson_duration_defaults;
create policy school_lesson_duration_member_read
on public.school_lesson_duration_defaults for select to authenticated
using (public.is_active_school_member(school_id));

drop policy if exists school_lesson_duration_admin_insert on public.school_lesson_duration_defaults;
create policy school_lesson_duration_admin_insert
on public.school_lesson_duration_defaults for insert to authenticated
with check (public.is_school_admin(school_id));

drop policy if exists school_lesson_duration_admin_update on public.school_lesson_duration_defaults;
create policy school_lesson_duration_admin_update
on public.school_lesson_duration_defaults for update to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

drop policy if exists school_lesson_duration_admin_delete on public.school_lesson_duration_defaults;
create policy school_lesson_duration_admin_delete
on public.school_lesson_duration_defaults for delete to authenticated
using (public.is_school_admin(school_id));

create table if not exists public.school_calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exception_date date not null,
  kind text not null check (kind in ('holiday','closure','exam','event')),
  label text not null,
  suppress_ordinary_teaching boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  unique (school_id, exception_date, kind, label)
);

alter table public.school_calendar_exceptions enable row level security;
revoke all on table public.school_calendar_exceptions from public, anon, authenticated;
grant select on table public.school_calendar_exceptions to authenticated;
grant insert, update, delete on table public.school_calendar_exceptions to authenticated;
grant all on table public.school_calendar_exceptions to service_role;

drop policy if exists school_calendar_exception_member_read on public.school_calendar_exceptions;
create policy school_calendar_exception_member_read
on public.school_calendar_exceptions for select to authenticated
using (public.is_active_school_member(school_id));

drop policy if exists school_calendar_exception_admin_write on public.school_calendar_exceptions;
create policy school_calendar_exception_admin_write
on public.school_calendar_exceptions for all to authenticated
using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

create table if not exists public.teacher_absences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  check (starts_at < ends_at)
);

alter table public.teacher_absences enable row level security;
revoke all on table public.teacher_absences from public, anon, authenticated;
grant select, insert, update, delete on table public.teacher_absences to authenticated;
grant all on table public.teacher_absences to service_role;

drop policy if exists teacher_absence_read on public.teacher_absences;
create policy teacher_absence_read
on public.teacher_absences for select to authenticated
using (
  teacher_id = (select auth.uid())
  or public.is_school_admin(school_id)
);

drop policy if exists teacher_absence_insert on public.teacher_absences;
create policy teacher_absence_insert
on public.teacher_absences for insert to authenticated
with check (
  (teacher_id = (select auth.uid()) and public.is_active_school_member(school_id))
  or public.is_school_admin(school_id)
);

drop policy if exists teacher_absence_update on public.teacher_absences;
create policy teacher_absence_update
on public.teacher_absences for update to authenticated
using (
  teacher_id = (select auth.uid())
  or public.is_school_admin(school_id)
)
with check (
  (teacher_id = (select auth.uid()) and public.is_active_school_member(school_id))
  or public.is_school_admin(school_id)
);

drop policy if exists teacher_absence_delete on public.teacher_absences;
create policy teacher_absence_delete
on public.teacher_absences for delete to authenticated
using (
  teacher_id = (select auth.uid())
  or public.is_school_admin(school_id)
);

alter table public.teaching_occurrences
  add column if not exists actual_teacher_id uuid references public.profiles(id) on delete set null;
alter table public.teaching_occurrences
  add column if not exists exception_reason text;

create index if not exists idx_calendar_exception_school_date
  on public.school_calendar_exceptions(school_id, exception_date);
create index if not exists idx_teacher_absence_teacher_range
  on public.teacher_absences(teacher_id, starts_at, ends_at);
create index if not exists idx_teaching_occurrences_actual_teacher_date
  on public.teaching_occurrences(actual_teacher_id, occurrence_date)
  where actual_teacher_id is not null;

create or replace function public.assign_occurrence_substitute(
  p_occurrence_id uuid,
  p_substitute_teacher_id uuid,
  p_reason text
)
returns public.teaching_occurrences
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v public.teaching_occurrences;
begin
  select * into v
  from public.teaching_occurrences
  where id = p_occurrence_id
  for update;

  if v.id is null then raise exception 'OCCURRENCE_NOT_FOUND'; end if;
  if not public.is_school_admin(v.school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
  if v.lifecycle in ('completed','cancelled','rescheduled') then raise exception 'OCCURRENCE_LOCKED'; end if;

  if not exists (
    select 1 from public.school_members sm
    where sm.school_id = v.school_id
      and sm.profile_id = p_substitute_teacher_id
      and sm.role::text = 'teacher'
  ) then
    raise exception 'SUBSTITUTE_NOT_SCHOOL_TEACHER';
  end if;

  if exists (
    select 1
    from public.teaching_occurrences o
    join public.timetable_slots s on s.id = o.timetable_slot_id
    join public.timetable_slots target on target.id = v.timetable_slot_id
    where coalesce(o.actual_teacher_id, o.teacher_id) = p_substitute_teacher_id
      and o.occurrence_date = v.occurrence_date
      and o.id <> v.id
      and o.lifecycle not in ('cancelled','rescheduled')
      and s.start_time < target.end_time
      and s.end_time > target.start_time
  ) then
    raise exception 'SUBSTITUTE_CONFLICT';
  end if;

  update public.teaching_occurrences
  set actual_teacher_id = p_substitute_teacher_id,
      exception_reason = nullif(btrim(p_reason),'')
  where id = v.id
  returning * into v;

  return v;
end;
$function$;

revoke all on function public.assign_occurrence_substitute(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.assign_occurrence_substitute(uuid,uuid,text)
  to authenticated;

create or replace function public.apply_teacher_absence(p_absence_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  a public.teacher_absences;
  n integer;
begin
  select * into a
  from public.teacher_absences
  where id = p_absence_id;

  if a.id is null then raise exception 'ABSENCE_NOT_FOUND'; end if;
  if auth.uid() <> a.teacher_id and not public.is_school_admin(a.school_id) then
    raise exception 'ABSENCE_ACCESS_DENIED';
  end if;

  update public.teaching_occurrences o
  set exception_reason = coalesce(nullif(btrim(a.reason),''),'Teacher absent')
  from public.timetable_slots s
  where o.timetable_slot_id = s.id
    and o.teacher_id = a.teacher_id
    and o.school_id = a.school_id
    and o.lifecycle in ('planned','ready')
    and (o.occurrence_date + s.start_time) at time zone 'Africa/Nairobi' < a.ends_at
    and (o.occurrence_date + s.end_time) at time zone 'Africa/Nairobi' > a.starts_at;

  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.apply_teacher_absence(uuid)
  from public, anon, authenticated;
grant execute on function public.apply_teacher_absence(uuid)
  to authenticated;

create or replace function public.get_my_substitute_occurrences(
  p_from date,
  p_until date
)
returns table (
  occurrence_id uuid,
  occurrence_date date,
  school_id uuid,
  timetable_slot_id uuid,
  class_id uuid,
  subject_id uuid,
  start_time time,
  end_time time,
  room text,
  lifecycle text,
  exception_reason text,
  original_teacher_id uuid
)
language plpgsql
security definer
stable
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_from is null or p_until is null or p_until < p_from or p_until > p_from + 31 then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  return query
  select
    o.id,
    o.occurrence_date,
    o.school_id,
    o.timetable_slot_id,
    o.class_id,
    o.subject_id,
    s.start_time,
    s.end_time,
    s.room,
    o.lifecycle,
    o.exception_reason,
    o.teacher_id
  from public.teaching_occurrences o
  join public.timetable_slots s on s.id = o.timetable_slot_id
  where o.actual_teacher_id = v_uid
    and o.occurrence_date between p_from and p_until
    and o.lifecycle not in ('cancelled','rescheduled')
    and exists (
      select 1 from public.school_members sm
      where sm.school_id = o.school_id
        and sm.profile_id = v_uid
        and sm.role::text = 'teacher'
    )
  order by o.occurrence_date, s.start_time;
end;
$function$;

revoke all on function public.get_my_substitute_occurrences(date,date)
  from public, anon, authenticated;
grant execute on function public.get_my_substitute_occurrences(date,date)
  to authenticated;

-- Multi-school-safe snapshots: each serialized slot carries its own school_id.
-- The snapshot header retains the active school only as a grouping/display value.
create or replace function public.snapshot_timetable(p_label text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_school uuid;
  v_slots jsonb;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if nullif(btrim(p_label), '') is null then raise exception 'label_required'; end if;

  select pref.school_id into v_school
  from public.teacher_active_school_preferences pref
  join public.school_members sm
    on sm.school_id = pref.school_id
   and sm.profile_id = v_uid
   and sm.role::text = 'teacher'
  where pref.teacher_id = v_uid;

  if v_school is null then
    select sm.school_id into v_school
    from public.school_members sm
    where sm.profile_id = v_uid and sm.role::text = 'teacher'
    order by sm.school_id
    limit 1;
  end if;
  if v_school is null then raise exception 'school_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'school_id', s.school_id,
    'class_id', s.class_id,
    'subject_id', s.subject_id,
    'day_of_week', s.day_of_week,
    'start_time', s.start_time,
    'end_time', s.end_time,
    'room', s.room,
    'period_id', s.period_id,
    'allocation_units', s.allocation_units,
    'recurrence_pattern', s.recurrence_pattern
  ) order by s.school_id, s.day_of_week, s.start_time), '[]'::jsonb)
  into v_slots
  from public.timetable_slots s
  where s.teacher_id = v_uid
    and (s.effective_until is null or s.effective_until >= v_today);

  if v_slots = '[]'::jsonb then raise exception 'nothing_to_snapshot'; end if;

  insert into public.timetable_snapshots (school_id, teacher_id, label, slots)
  values (v_school, v_uid, btrim(p_label), v_slots)
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.restore_timetable_snapshot(
  p_snapshot_id uuid,
  p_effective_from date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_snap public.timetable_snapshots;
  v_count integer := 0;
  v_row jsonb;
  v_row_school uuid;
  v_constraint text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_snap
  from public.timetable_snapshots
  where id = p_snapshot_id;
  if v_snap.id is null then raise exception 'snapshot_not_found'; end if;
  if v_snap.teacher_id <> v_uid then raise exception 'snapshot_not_owned'; end if;
  if p_effective_from is null or p_effective_from < v_today then raise exception 'invalid_date'; end if;

  if exists (
    select 1
    from public.timetable_slots s
    join public.teaching_occurrences o on o.timetable_slot_id = s.id
    where s.teacher_id = v_uid
      and s.effective_from >= p_effective_from
      and o.lifecycle in ('in_progress','completed')
  ) then
    raise exception 'future_slot_has_occurrences';
  end if;

  update public.teaching_occurrences o
  set lifecycle = 'cancelled',
      cancelled_at = clock_timestamp(),
      cancelled_reason = 'snapshot_restored'
  from public.timetable_slots s
  where o.timetable_slot_id = s.id
    and s.teacher_id = v_uid
    and o.lifecycle in ('planned','ready')
    and o.occurrence_date >= p_effective_from;

  delete from public.timetable_slots s
  where s.teacher_id = v_uid
    and s.effective_from >= p_effective_from
    and not exists (
      select 1 from public.teaching_occurrences o
      where o.timetable_slot_id = s.id
    );

  update public.timetable_slots
  set effective_until = p_effective_from - 1,
      updated_at = clock_timestamp()
  where teacher_id = v_uid
    and effective_from < p_effective_from
    and (effective_until is null or effective_until >= p_effective_from);

  begin
    for v_row in
      select * from jsonb_array_elements(v_snap.slots)
    loop
      v_row_school := coalesce(
        nullif(v_row->>'school_id','')::uuid,
        v_snap.school_id
      );

      if not exists (
        select 1 from public.school_members sm
        where sm.school_id = v_row_school
          and sm.profile_id = v_uid
          and sm.role::text = 'teacher'
      ) then
        raise exception 'snapshot_school_access_denied';
      end if;

      insert into public.timetable_slots (
        school_id, teacher_id, class_id, subject_id, day_of_week,
        start_time, end_time, room, period_id, allocation_units,
        recurrence_pattern, effective_from, effective_until
      )
      values (
        v_row_school,
        v_uid,
        (v_row->>'class_id')::uuid,
        (v_row->>'subject_id')::uuid,
        (v_row->>'day_of_week')::integer,
        (v_row->>'start_time')::time,
        (v_row->>'end_time')::time,
        nullif(v_row->>'room',''),
        nullif(v_row->>'period_id','')::uuid,
        coalesce(nullif(v_row->>'allocation_units','')::numeric, 1),
        coalesce(nullif(v_row->>'recurrence_pattern',''), 'EVERY_WEEK'),
        p_effective_from,
        null
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
$function$;

revoke all on function public.snapshot_timetable(text)
  from public, anon, authenticated;
grant execute on function public.snapshot_timetable(text) to authenticated;

revoke all on function public.restore_timetable_snapshot(uuid,date)
  from public, anon, authenticated;
grant execute on function public.restore_timetable_snapshot(uuid,date) to authenticated;


create or replace function public.get_school_day_blocks_for_member(p_school_id uuid)
returns setof public.school_periods
language sql
security definer
stable
set search_path = ''
as $function$
  select sp.*
  from public.school_periods sp
  where sp.school_id = p_school_id
    and exists (
      select 1 from public.school_members sm
      where sm.school_id = p_school_id
        and sm.profile_id = auth.uid()
        and sm.role::text = 'teacher'
    )
  order by sp.schedule_day, sp.start_time, sp.period_number;
$function$;

revoke all on function public.get_school_day_blocks_for_member(uuid)
  from public, anon, authenticated;
grant execute on function public.get_school_day_blocks_for_member(uuid)
  to authenticated;

create or replace function public.can_manage_my_school_timetable(p_school_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $function$
  select auth.uid() is not null
    and p_school_id is not null
    and public.is_school_admin(p_school_id);
$function$;

revoke all on function public.can_manage_my_school_timetable(uuid)
  from public, anon, authenticated;
grant execute on function public.can_manage_my_school_timetable(uuid)
  to authenticated;

create or replace function public.save_school_period_block(
  p_period_id uuid,
  p_school_id uuid,
  p_schedule_day integer,
  p_label text,
  p_start_time time,
  p_end_time time,
  p_kind text,
  p_protected boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_number integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_school_admin(p_school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
  if p_schedule_day is null or p_schedule_day < 0 or p_schedule_day > 7 then raise exception 'INVALID_DAY'; end if;
  if p_start_time is null or p_end_time is null or p_start_time >= p_end_time then raise exception 'INVALID_TIME_RANGE'; end if;
  if nullif(btrim(p_label),'') is null then raise exception 'LABEL_REQUIRED'; end if;
  if p_kind is null or p_kind not in (
    'lesson','break','lunch','assembly','games','club','prep','staff_meeting',
    'guidance','examination','school_event','free','custom'
  ) then raise exception 'INVALID_PERIOD_KIND'; end if;

  if exists (
    select 1
    from public.school_periods sp
    where sp.school_id = p_school_id
      and (p_period_id is null or sp.id <> p_period_id)
      and (sp.schedule_day = 0 or p_schedule_day = 0 or sp.schedule_day = p_schedule_day)
      and sp.start_time < p_end_time
      and sp.end_time > p_start_time
  ) then
    raise exception 'SCHOOL_PERIOD_OVERLAP';
  end if;

  if p_period_id is not null then
    update public.school_periods
    set schedule_day = p_schedule_day,
        label = btrim(p_label),
        start_time = p_start_time,
        end_time = p_end_time,
        kind = p_kind,
        protected = coalesce(p_protected,false)
    where id = p_period_id and school_id = p_school_id
    returning id into v_id;
    if v_id is null then raise exception 'PERIOD_NOT_FOUND'; end if;
    return v_id;
  end if;

  select coalesce(max(sp.period_number),0) + 1
  into v_number
  from public.school_periods sp
  where sp.school_id = p_school_id;

  insert into public.school_periods(
    school_id, period_number, schedule_day, label,
    start_time, end_time, kind, protected
  )
  values (
    p_school_id, v_number, p_schedule_day, btrim(p_label),
    p_start_time, p_end_time, p_kind, coalesce(p_protected,false)
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.save_school_period_block(uuid,uuid,integer,text,time,time,text,boolean)
  from public, anon, authenticated;
grant execute on function public.save_school_period_block(uuid,uuid,integer,text,time,time,text,boolean)
  to authenticated;

create or replace function public.delete_school_period_block(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_school uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;

  select sp.school_id into v_school
  from public.school_periods sp
  where sp.id = p_period_id;

  if v_school is null then raise exception 'PERIOD_NOT_FOUND'; end if;
  if not public.is_school_admin(v_school) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;

  if exists (
    select 1 from public.timetable_slots ts
    where ts.period_id = p_period_id
      and (ts.effective_until is null or ts.effective_until >= (now() at time zone 'Africa/Nairobi')::date)
  ) then
    raise exception 'PERIOD_IN_USE';
  end if;

  delete from public.school_periods where id = p_period_id;
end;
$function$;

revoke all on function public.delete_school_period_block(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_school_period_block(uuid)
  to authenticated;

create or replace function public.set_school_lesson_duration_default(
  p_school_id uuid,
  p_grade_label text,
  p_duration_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_school_admin(p_school_id) then raise exception 'SCHOOL_ADMIN_REQUIRED'; end if;
  if nullif(btrim(p_grade_label),'') is null then raise exception 'GRADE_REQUIRED'; end if;
  if p_duration_minutes is null or p_duration_minutes < 20 or p_duration_minutes > 120 then
    raise exception 'INVALID_DURATION';
  end if;

  insert into public.school_lesson_duration_defaults(
    school_id, grade_label, duration_minutes, created_by, updated_at
  )
  values (
    p_school_id, btrim(p_grade_label), p_duration_minutes, auth.uid(), clock_timestamp()
  )
  on conflict (school_id, grade_label)
  do update set
    duration_minutes = excluded.duration_minutes,
    updated_at = clock_timestamp()
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.set_school_lesson_duration_default(uuid,text,integer)
  from public, anon, authenticated;
grant execute on function public.set_school_lesson_duration_default(uuid,text,integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
