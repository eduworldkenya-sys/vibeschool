-- authorization-test: public.class_subject_allocations
create table if not exists public.class_subject_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  academic_term_id uuid not null references public.academic_terms(id) on delete cascade,
  baseline_allocation_id uuid references public.subject_weekly_allocations(id) on delete set null,
  baseline_units_per_week numeric(6,2),
  effective_units_per_week numeric(6,2),
  source text not null default 'KICD',
  is_override boolean not null default false,
  override_reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  effective_from date not null,
  effective_until date,
  curriculum_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_subject_allocations_source_check check (source in ('KICD','SCHOOL_OVERRIDE','CUSTOM','OPTIONAL_SUBJECT','UNKNOWN')),
  constraint class_subject_allocations_units_check check (effective_units_per_week is null or effective_units_per_week > 0),
  constraint class_subject_allocations_range_check check (effective_until is null or effective_until >= effective_from),
  constraint class_subject_allocations_override_reason_check check (not is_override or nullif(btrim(override_reason),'') is not null),
  constraint class_subject_allocations_unique unique (class_id, subject_id, academic_term_id)
);

-- Production already depends on this helper for school-scoped authorization.
-- Re-declare the canonical definition here so a blank rebuild does not rely on
-- production-only schema drift before the RLS policy below is created.
create or replace function public.is_active_school_member(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.school_members mine
    join public.schools ms on ms.id = mine.school_id
    where mine.profile_id = auth.uid()
      and mine.school_id = p_school_id
      and ms.status = 'active'
  )
$$;

revoke all on function public.is_active_school_member(uuid) from public;
grant execute on function public.is_active_school_member(uuid) to authenticated;

alter table public.class_subject_allocations enable row level security;

revoke all on public.class_subject_allocations from anon;
revoke insert, update, delete on public.class_subject_allocations from authenticated;
grant select on public.class_subject_allocations to authenticated;

drop policy if exists class_subject_allocations_member_select on public.class_subject_allocations;
create policy class_subject_allocations_member_select
on public.class_subject_allocations for select
to authenticated
using (public.is_active_school_member(school_id));

alter table public.timetable_slots
  add column if not exists allocation_units numeric(6,2) not null default 1,
  add column if not exists recurrence_pattern text not null default 'EVERY_WEEK';

alter table public.timetable_slots
  drop constraint if exists timetable_slots_allocation_units_check,
  add constraint timetable_slots_allocation_units_check check (allocation_units > 0 and allocation_units <= 8),
  drop constraint if exists timetable_slots_recurrence_pattern_check,
  add constraint timetable_slots_recurrence_pattern_check check (recurrence_pattern in ('EVERY_WEEK','WEEK_A','WEEK_B','ODD_WEEK','EVEN_WEEK'));

alter table public.timetable_slots alter column teacher_id drop not null;

alter table public.timetable_slots drop constraint if exists timetable_slots_teacher_id_fkey;
alter table public.timetable_slots
  add constraint timetable_slots_teacher_id_fkey foreign key (teacher_id) references public.profiles(id) on delete set null;

alter table public.timetable_slots drop constraint if exists uq_timetable_slot_exact;
alter table public.timetable_slots
  add constraint uq_timetable_slot_exact unique nulls not distinct
  (teacher_id, class_id, subject_id, day_of_week, start_time, end_time, effective_from);

create or replace function public.reconcile_class_subject_allocations(
  p_school_id uuid,
  p_academic_term_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_term public.academic_terms%rowtype;
  v_upserted integer := 0;
begin
  if v_uid is null or not public.is_active_school_member(p_school_id) then
    raise exception 'SCHOOL_ACCESS_DENIED';
  end if;

  select * into v_term
  from public.academic_terms
  where id = p_academic_term_id and school_id = p_school_id;

  if not found then
    raise exception 'ACADEMIC_TERM_NOT_FOUND';
  end if;

  insert into public.class_subject_allocations (
    school_id, class_id, subject_id, academic_term_id,
    baseline_allocation_id, baseline_units_per_week, effective_units_per_week,
    source, is_override, effective_from, effective_until, updated_at
  )
  select distinct
    tc.school_id,
    tc.class_id,
    tc.subject_id,
    v_term.id,
    swa.id,
    swa.lessons_per_week::numeric,
    swa.lessons_per_week::numeric,
    case when swa.id is null then 'UNKNOWN' else 'KICD' end,
    false,
    v_term.start_date,
    v_term.end_date,
    now()
  from public.teacher_classes tc
  join public.classes c on c.id = tc.class_id
  join public.subjects s on s.id = tc.subject_id
  left join lateral (
    select a.*
    from public.subject_weekly_allocations a
    where lower(btrim(a.grade)) = lower(btrim(c.name))
      and lower(btrim(a.subject_label)) = lower(btrim(s.name))
    order by a.created_at desc, a.id
    limit 1
  ) swa on true
  where tc.school_id = p_school_id
  on conflict (class_id, subject_id, academic_term_id) do update
  set baseline_allocation_id = excluded.baseline_allocation_id,
      baseline_units_per_week = excluded.baseline_units_per_week,
      effective_units_per_week = case
        when public.class_subject_allocations.is_override then public.class_subject_allocations.effective_units_per_week
        else excluded.effective_units_per_week
      end,
      source = case
        when public.class_subject_allocations.is_override then public.class_subject_allocations.source
        else excluded.source
      end,
      effective_from = excluded.effective_from,
      effective_until = excluded.effective_until,
      updated_at = now();

  get diagnostics v_upserted = row_count;
  return jsonb_build_object('school_id', p_school_id, 'academic_term_id', p_academic_term_id, 'reconciled', v_upserted);
end;
$$;

revoke all on function public.reconcile_class_subject_allocations(uuid,uuid) from public;
grant execute on function public.reconcile_class_subject_allocations(uuid,uuid) to authenticated;

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
    select c.id as class_id, c.school_id, t.start_date, t.end_date
    from public.classes c
    join public.academic_terms t on t.id = p_academic_term_id and t.school_id = c.school_id
    where c.id = p_class_id
      and public.is_active_school_member(c.school_id)
  ),
  allocations as (
    select a.*
    from public.class_subject_allocations a
    join ctx on ctx.class_id = a.class_id
    where a.academic_term_id = p_academic_term_id
  ),
  scheduled as (
    select ts.subject_id,
      sum(ts.allocation_units * case when ts.recurrence_pattern = 'EVERY_WEEK' then 1::numeric else 0.5::numeric end) as units
    from public.timetable_slots ts
    join ctx on ctx.class_id = ts.class_id
    where ts.effective_from <= ctx.end_date
      and coalesce(ts.effective_until, ctx.end_date) >= ctx.start_date
    group by ts.subject_id
  ),
  teachers as (
    select tc.subject_id, count(distinct tc.teacher_id)::integer as teacher_count
    from public.teacher_classes tc
    join ctx on ctx.class_id = tc.class_id
    group by tc.subject_id
  )
  select
    a.subject_id,
    s.name,
    a.effective_units_per_week as expected_units,
    coalesce(sc.units,0)::numeric as scheduled_units,
    case when a.effective_units_per_week is null then null else greatest(a.effective_units_per_week - coalesce(sc.units,0),0) end as missing_units,
    case when a.effective_units_per_week is null then null else greatest(coalesce(sc.units,0) - a.effective_units_per_week,0) end as excess_units,
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

comment on table public.class_subject_allocations is 'Canonical effective Class + Subject + Academic Term lesson allocation. subject_weekly_allocations remains the national baseline.';
comment on column public.timetable_slots.allocation_units is 'Curriculum allocation units represented by this slot; supports double/triple periods without row counting.';
comment on column public.timetable_slots.recurrence_pattern is 'Structural weekly recurrence. Alternating patterns count as 0.5 weekly capacity in allocation health.';
