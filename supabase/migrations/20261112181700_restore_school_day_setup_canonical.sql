-- authorization-test: public.school_lesson_duration_defaults authenticated active school members can read only; school administrators alone insert/update/delete; anon has no table grant; production verified RLS enabled with four policies.

-- Reconcile the existing school-day setup API with production.
-- This is a focused replay of the safe existing definitions from
-- 20261004200000_timetable_modernization_closure.sql.
-- No timetable slots, attendance, or existing school_periods rows are modified.
-- Applied to VibeSchool Supabase as restore_school_day_setup_canonical.

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
