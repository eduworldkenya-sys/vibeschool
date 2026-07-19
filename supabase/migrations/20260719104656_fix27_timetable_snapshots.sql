-- Fix 27: revision-safe versioning on the effective-date model. Applied live
-- 2026-07-19 via MCP; tracked copy. History is never rewritten: restore
-- expires the current revision and inserts snapshot rows as new slots.

create table if not exists public.timetable_snapshots (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  label      text not null,
  slots      jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.timetable_snapshots enable row level security;
create policy timetable_snapshots_own on public.timetable_snapshots for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create or replace function public.snapshot_timetable(p_label text)
returns uuid
language plpgsql security definer set search_path to 'public' as $$
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
    'end_time', s.end_time, 'room', s.room, 'period_id', s.period_id
  )), '[]'::jsonb) into v_slots
  from timetable_slots s
  where s.teacher_id = v_uid
    and (s.effective_until is null or s.effective_until >= v_today);
  if v_slots = '[]'::jsonb then raise exception 'nothing_to_snapshot'; end if;

  insert into timetable_snapshots (school_id, teacher_id, label, slots)
  values (v_school, v_uid, btrim(p_label), v_slots)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.restore_timetable_snapshot(
  p_snapshot_id uuid,
  p_effective_from date
) returns integer
language plpgsql security definer set search_path to 'public' as $$
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
  if p_effective_from is null or p_effective_from < v_today then
    raise exception 'invalid_date'; end if;

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
         start_time, end_time, room, period_id, effective_from, effective_until)
      values (
        v_snap.school_id, v_uid,
        (v_row->>'class_id')::uuid, (v_row->>'subject_id')::uuid,
        (v_row->>'day_of_week')::integer,
        (v_row->>'start_time')::time, (v_row->>'end_time')::time,
        nullif(v_row->>'room',''), (v_row->>'period_id')::uuid,
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
end $$;

revoke execute on function public.snapshot_timetable(text) from anon, public;
revoke execute on function public.restore_timetable_snapshot(uuid, date) from anon, public;
grant execute on function public.snapshot_timetable(text) to authenticated;
grant execute on function public.restore_timetable_snapshot(uuid, date) to authenticated;
