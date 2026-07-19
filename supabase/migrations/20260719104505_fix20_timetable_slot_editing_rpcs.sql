-- Fix 20: guarded slot editing. Applied live 2026-07-19 via MCP; this file
-- is the tracked repo copy. The exclusion constraints stay the final
-- integrity authority; these RPCs map violations to stable error codes and
-- manage occurrence fallout explicitly:
--   * day/time changes are blocked if started/completed history exists
--   * shrinking the effective window never orphans history
--   * planned/ready future occurrences are cancelled (reason recorded)
--   * hard delete only when zero occurrences reference the slot

create or replace function public.update_timetable_slot(
  p_slot_id uuid,
  p_day_of_week integer default null,
  p_start_time time without time zone default null,
  p_end_time time without time zone default null,
  p_room text default null,
  p_clear_room boolean default false,
  p_effective_from date default null,
  p_effective_until date default null,
  p_clear_effective_until boolean default false
) returns public.timetable_slots
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_old public.timetable_slots;
  v_new public.timetable_slots;
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_day integer; v_start time; v_end time; v_from date; v_until date; v_room text;
  v_time_changed boolean;
  v_constraint text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_old from timetable_slots where id = p_slot_id;
  if v_old.id is null then raise exception 'slot_not_found'; end if;
  if v_old.teacher_id <> v_uid then raise exception 'slot_not_owned'; end if;

  v_day   := coalesce(p_day_of_week, v_old.day_of_week);
  v_start := coalesce(p_start_time, v_old.start_time);
  v_end   := coalesce(p_end_time, v_old.end_time);
  v_from  := coalesce(p_effective_from, v_old.effective_from);
  v_until := case when p_clear_effective_until then null
                  else coalesce(p_effective_until, v_old.effective_until) end;
  v_room  := case when p_clear_room then null
                  else coalesce(nullif(btrim(p_room), ''), v_old.room) end;

  if v_day < 1 or v_day > 7 or v_start >= v_end then raise exception 'invalid_time'; end if;
  if v_until is not null and v_until < v_from then raise exception 'invalid_date_range'; end if;

  v_time_changed := (v_day <> v_old.day_of_week or v_start <> v_old.start_time or v_end <> v_old.end_time);

  if v_time_changed and exists (
    select 1 from teaching_occurrences o
    where o.timetable_slot_id = p_slot_id and o.lifecycle in ('in_progress','completed')
  ) then raise exception 'occurrence_history_exists'; end if;

  if exists (
    select 1 from teaching_occurrences o
    where o.timetable_slot_id = p_slot_id and o.lifecycle in ('in_progress','completed')
      and (o.occurrence_date < v_from or (v_until is not null and o.occurrence_date > v_until))
  ) then raise exception 'occurrence_outside_window'; end if;

  update teaching_occurrences
     set lifecycle = 'cancelled',
         cancelled_at = clock_timestamp(),
         cancelled_reason = 'slot_updated'
   where timetable_slot_id = p_slot_id
     and lifecycle in ('planned','ready')
     and (v_time_changed
          or occurrence_date < v_from
          or (v_until is not null and occurrence_date > v_until));

  begin
    update timetable_slots
       set day_of_week = v_day, start_time = v_start, end_time = v_end,
           room = v_room, effective_from = v_from, effective_until = v_until,
           updated_at = clock_timestamp()
     where id = p_slot_id
     returning * into v_new;
  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'excl_teacher_overlap' then raise exception 'TEACHER_CONFLICT';
      elsif v_constraint = 'excl_class_overlap' then raise exception 'CLASS_CONFLICT';
      elsif v_constraint = 'excl_room_overlap' then raise exception 'ROOM_CONFLICT';
      else raise exception 'SCHEDULE_CONFLICT'; end if;
    when unique_violation then raise exception 'DUPLICATE_SLOT';
  end;
  return v_new;
end $$;

create or replace function public.expire_timetable_slot(
  p_slot_id uuid,
  p_effective_until date default null
) returns public.timetable_slots
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_old public.timetable_slots;
  v_new public.timetable_slots;
  v_until date := coalesce(p_effective_until, (now() at time zone 'Africa/Nairobi')::date);
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_old from timetable_slots where id = p_slot_id;
  if v_old.id is null then raise exception 'slot_not_found'; end if;
  if v_old.teacher_id <> v_uid then raise exception 'slot_not_owned'; end if;
  if v_until < v_old.effective_from then raise exception 'invalid_date_range'; end if;

  if exists (
    select 1 from teaching_occurrences o
    where o.timetable_slot_id = p_slot_id
      and o.lifecycle in ('in_progress','completed')
      and o.occurrence_date > v_until
  ) then raise exception 'occurrence_outside_window'; end if;

  update teaching_occurrences
     set lifecycle = 'cancelled', cancelled_at = clock_timestamp(),
         cancelled_reason = 'slot_expired'
   where timetable_slot_id = p_slot_id
     and lifecycle in ('planned','ready')
     and occurrence_date > v_until;

  update timetable_slots
     set effective_until = v_until, updated_at = clock_timestamp()
   where id = p_slot_id
   returning * into v_new;
  return v_new;
end $$;

create or replace function public.delete_timetable_slot(p_slot_id uuid)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_old public.timetable_slots;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_old from timetable_slots where id = p_slot_id;
  if v_old.id is null then raise exception 'slot_not_found'; end if;
  if v_old.teacher_id <> v_uid then raise exception 'slot_not_owned'; end if;
  if exists (select 1 from teaching_occurrences o where o.timetable_slot_id = p_slot_id)
    then raise exception 'occurrences_exist'; end if;
  begin
    delete from timetable_slots where id = p_slot_id;
  exception when foreign_key_violation then
    raise exception 'slot_referenced';
  end;
end $$;

create or replace function public.duplicate_active_timetable(p_effective_from date)
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Nairobi')::date;
  v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_effective_from is null or p_effective_from < v_today then
    raise exception 'invalid_date'; end if;
  if exists (
    select 1 from timetable_slots s
    where s.teacher_id = v_uid and s.effective_from >= p_effective_from
  ) then raise exception 'future_revision_exists'; end if;

  update timetable_slots
     set effective_until = p_effective_from - 1, updated_at = clock_timestamp()
   where teacher_id = v_uid
     and effective_from < p_effective_from
     and (effective_until is null or effective_until >= p_effective_from);

  insert into timetable_slots
    (school_id, teacher_id, class_id, subject_id, day_of_week,
     start_time, end_time, room, effective_from, effective_until)
  select school_id, teacher_id, class_id, subject_id, day_of_week,
         start_time, end_time, room, p_effective_from, null
  from timetable_slots
  where teacher_id = v_uid and effective_until = p_effective_from - 1;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.update_timetable_slot(uuid,integer,time,time,text,boolean,date,date,boolean) from anon, public;
revoke execute on function public.expire_timetable_slot(uuid,date) from anon, public;
revoke execute on function public.delete_timetable_slot(uuid) from anon, public;
revoke execute on function public.duplicate_active_timetable(date) from anon, public;
grant execute on function public.update_timetable_slot(uuid,integer,time,time,text,boolean,date,date,boolean) to authenticated;
grant execute on function public.expire_timetable_slot(uuid,date) to authenticated;
grant execute on function public.delete_timetable_slot(uuid) to authenticated;
grant execute on function public.duplicate_active_timetable(date) to authenticated;
