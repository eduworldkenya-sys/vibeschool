-- Fix 21: named school periods. Applied live 2026-07-19 via MCP; tracked copy.
-- timetable_slots.period_id is optional and non-breaking.

create table if not exists public.school_periods (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  period_number integer not null,
  label         text not null,
  start_time    time without time zone not null,
  end_time      time without time zone not null,
  kind          text not null default 'lesson' check (kind in ('lesson','break')),
  created_at    timestamptz not null default now(),
  constraint school_periods_number_unique unique (school_id, period_number),
  constraint school_periods_time_check check (start_time < end_time)
);

alter table public.school_periods enable row level security;

create policy school_periods_teacher_read on public.school_periods for select
  using (exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = auth.uid() and tc.school_id = school_periods.school_id
  ));

create policy school_periods_admin_all on public.school_periods for all
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));

alter table public.timetable_slots
  add column if not exists period_id uuid references public.school_periods(id) on delete set null;

create or replace function public.seed_default_school_periods()
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
  v_count integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select tc.school_id into v_school
  from teacher_classes tc where tc.teacher_id = v_uid limit 1;
  if v_school is null then raise exception 'school_not_found'; end if;
  if exists (select 1 from school_periods where school_id = v_school) then
    raise exception 'periods_already_exist'; end if;

  insert into school_periods (school_id, period_number, label, start_time, end_time, kind) values
    (v_school, 1,  'Period 1', '08:00', '08:40', 'lesson'),
    (v_school, 2,  'Period 2', '08:40', '09:20', 'lesson'),
    (v_school, 3,  'Period 3', '09:20', '10:00', 'lesson'),
    (v_school, 4,  'Break',    '10:00', '10:30', 'break'),
    (v_school, 5,  'Period 4', '10:30', '11:10', 'lesson'),
    (v_school, 6,  'Period 5', '11:10', '11:50', 'lesson'),
    (v_school, 7,  'Lunch',    '11:50', '13:00', 'break'),
    (v_school, 8,  'Period 6', '13:00', '13:40', 'lesson'),
    (v_school, 9,  'Period 7', '13:40', '14:20', 'lesson'),
    (v_school, 10, 'Period 8', '14:20', '15:00', 'lesson');
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.seed_default_school_periods() from anon, public;
grant execute on function public.seed_default_school_periods() to authenticated;
