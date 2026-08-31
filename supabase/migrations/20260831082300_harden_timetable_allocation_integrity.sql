-- Harden the canonical allocation layer before exposing it to UI flows.

-- Alternating recurrence requires dated semantics and conflict-aware enforcement.
-- Keep the column future-ready, but reject non-weekly patterns until that P1 engine exists.
alter table public.timetable_slots
  drop constraint if exists timetable_slots_recurrence_pattern_check,
  add constraint timetable_slots_recurrence_pattern_check
    check (recurrence_pattern = 'EVERY_WEEK');

create index if not exists idx_class_subject_allocations_class_term
  on public.class_subject_allocations(class_id, academic_term_id);
create index if not exists idx_class_subject_allocations_school_term
  on public.class_subject_allocations(school_id, academic_term_id);
create index if not exists idx_timetable_slots_class_subject_effective
  on public.timetable_slots(class_id, subject_id, effective_from, effective_until);

create or replace function public.reconcile_class_subject_allocations(
  p_school_id uuid,
  p_academic_term_id uuid
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_term public.academic_terms%rowtype;
  v_upserted integer := 0;
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then
    raise exception 'SCHOOL_ADMIN_REQUIRED';
  end if;
  select * into v_term from public.academic_terms where id=p_academic_term_id and school_id=p_school_id;
  if not found then raise exception 'ACADEMIC_TERM_NOT_FOUND'; end if;

  -- Legacy reconciliation only. New class setup writes allocation rows directly,
  -- which permits a valid required subject before a teacher is assigned.
  insert into public.class_subject_allocations (
    school_id,class_id,subject_id,academic_term_id,baseline_allocation_id,
    baseline_units_per_week,effective_units_per_week,source,is_override,
    effective_from,effective_until,updated_at
  )
  select distinct tc.school_id,tc.class_id,tc.subject_id,v_term.id,swa.id,
    swa.lessons_per_week::numeric,swa.lessons_per_week::numeric,
    case when swa.id is null then 'UNKNOWN' else 'KICD' end,false,
    v_term.start_date,v_term.end_date,now()
  from public.teacher_classes tc
  join public.classes c on c.id=tc.class_id
  join public.subjects s on s.id=tc.subject_id
  left join lateral (
    select a.* from public.subject_weekly_allocations a
    where lower(btrim(a.grade))=lower(btrim(c.name))
      and lower(btrim(a.subject_label))=lower(btrim(s.name))
    order by a.created_at desc,a.id limit 1
  ) swa on true
  where tc.school_id=p_school_id
  on conflict(class_id,subject_id,academic_term_id) do update set
    baseline_allocation_id=excluded.baseline_allocation_id,
    baseline_units_per_week=excluded.baseline_units_per_week,
    effective_units_per_week=case when public.class_subject_allocations.is_override then public.class_subject_allocations.effective_units_per_week else excluded.effective_units_per_week end,
    source=case when public.class_subject_allocations.is_override then public.class_subject_allocations.source else excluded.source end,
    effective_from=excluded.effective_from,effective_until=excluded.effective_until,updated_at=now();
  get diagnostics v_upserted=row_count;
  return jsonb_build_object('school_id',p_school_id,'academic_term_id',p_academic_term_id,'reconciled',v_upserted);
end;
$$;

create or replace function public.set_class_subject_allocation(
  p_class_id uuid,
  p_subject_id uuid,
  p_academic_term_id uuid,
  p_effective_units_per_week numeric default null,
  p_override_reason text default null
) returns public.class_subject_allocations
language plpgsql security definer set search_path=public
as $$
declare
  v_class public.classes%rowtype;
  v_term public.academic_terms%rowtype;
  v_subject public.subjects%rowtype;
  v_baseline public.subject_weekly_allocations%rowtype;
  v_units numeric; v_override boolean; v_source text;
  v_row public.class_subject_allocations%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_class from public.classes where id=p_class_id;
  if not found or v_class.school_id is null then raise exception 'CLASS_NOT_FOUND'; end if;
  if not public.is_school_admin(v_class.school_id)
     and coalesce(v_class.teacher_id,'00000000-0000-0000-0000-000000000000'::uuid)<>auth.uid() then
    raise exception 'ALLOCATION_WRITE_FORBIDDEN';
  end if;
  select * into v_term from public.academic_terms where id=p_academic_term_id and school_id=v_class.school_id;
  if not found then raise exception 'ACADEMIC_TERM_NOT_FOUND'; end if;
  select * into v_subject from public.subjects where id=p_subject_id and (school_id=v_class.school_id or school_id is null);
  if not found then raise exception 'SUBJECT_NOT_FOUND'; end if;
  select a.* into v_baseline from public.subject_weekly_allocations a
   where lower(btrim(a.grade))=lower(btrim(v_class.name)) and lower(btrim(a.subject_label))=lower(btrim(v_subject.name))
   order by a.created_at desc,a.id limit 1;
  if p_effective_units_per_week is null then
    if v_baseline.id is null then raise exception 'ALLOCATION_BASELINE_UNKNOWN'; end if;
    v_units:=v_baseline.lessons_per_week; v_override:=false; v_source:='KICD';
  else
    if p_effective_units_per_week<=0 then raise exception 'INVALID_ALLOCATION_UNITS'; end if;
    v_units:=p_effective_units_per_week;
    v_override:=v_baseline.id is null or p_effective_units_per_week<>v_baseline.lessons_per_week;
    if v_override and nullif(btrim(p_override_reason),'') is null then raise exception 'OVERRIDE_REASON_REQUIRED'; end if;
    v_source:=case when v_override then 'SCHOOL_OVERRIDE' else 'KICD' end;
  end if;
  insert into public.class_subject_allocations(
    school_id,class_id,subject_id,academic_term_id,baseline_allocation_id,baseline_units_per_week,
    effective_units_per_week,source,is_override,override_reason,approved_by,effective_from,effective_until,updated_at
  ) values (
    v_class.school_id,p_class_id,p_subject_id,p_academic_term_id,v_baseline.id,v_baseline.lessons_per_week,
    v_units,v_source,v_override,case when v_override then p_override_reason else null end,auth.uid(),v_term.start_date,v_term.end_date,now()
  ) on conflict(class_id,subject_id,academic_term_id) do update set
    baseline_allocation_id=excluded.baseline_allocation_id,baseline_units_per_week=excluded.baseline_units_per_week,
    effective_units_per_week=excluded.effective_units_per_week,source=excluded.source,is_override=excluded.is_override,
    override_reason=excluded.override_reason,approved_by=excluded.approved_by,effective_from=excluded.effective_from,
    effective_until=excluded.effective_until,updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.set_class_subject_allocation(uuid,uuid,uuid,numeric,text) from public;
grant execute on function public.set_class_subject_allocation(uuid,uuid,uuid,numeric,text) to authenticated;

create or replace function public.get_timetable_allocation_health(
  p_class_id uuid,p_academic_term_id uuid
) returns table (
  subject_id uuid,subject_name text,expected_units numeric,scheduled_units numeric,
  missing_units numeric,excess_units numeric,status text,allocation_source text,
  is_override boolean,assigned_teacher_count integer,teacher_assignment_health text
)
language sql security definer set search_path=public stable
as $$
with ctx as (
 select c.id class_id,c.school_id,t.start_date,t.end_date from public.classes c
 join public.academic_terms t on t.id=p_academic_term_id and t.school_id=c.school_id
 where c.id=p_class_id and public.is_active_school_member(c.school_id)
), universe as (
 select a.subject_id from public.class_subject_allocations a join ctx on ctx.class_id=a.class_id where a.academic_term_id=p_academic_term_id
 union select tc.subject_id from public.teacher_classes tc join ctx on ctx.class_id=tc.class_id
 union select ts.subject_id from public.timetable_slots ts join ctx on ctx.class_id=ts.class_id
   where ts.effective_from<=ctx.end_date and coalesce(ts.effective_until,ctx.end_date)>=ctx.start_date
), scheduled as (
 select ts.subject_id,sum(ts.allocation_units)::numeric units from public.timetable_slots ts join ctx on ctx.class_id=ts.class_id
 where ts.effective_from<=ctx.end_date and coalesce(ts.effective_until,ctx.end_date)>=ctx.start_date group by ts.subject_id
), teachers as (
 select tc.subject_id,count(distinct tc.teacher_id)::int teacher_count from public.teacher_classes tc join ctx on ctx.class_id=tc.class_id group by tc.subject_id
)
select u.subject_id,s.name,a.effective_units_per_week,coalesce(sc.units,0),
 case when a.effective_units_per_week is null then null else greatest(a.effective_units_per_week-coalesce(sc.units,0),0) end,
 case when a.effective_units_per_week is null then null else greatest(coalesce(sc.units,0)-a.effective_units_per_week,0) end,
 case when a.id is null or a.effective_units_per_week is null then 'ALLOCATION_UNKNOWN'
      when coalesce(sc.units,0)=0 then 'UNSCHEDULED'
      when coalesce(sc.units,0)<a.effective_units_per_week then 'UNDER_ALLOCATED'
      when coalesce(sc.units,0)>a.effective_units_per_week then 'OVER_ALLOCATED'
      when coalesce(t.teacher_count,0)=0 then 'TEACHER_UNASSIGNED'
      when a.is_override then 'OVERRIDE' else 'COMPLETE' end,
 coalesce(a.source,'UNKNOWN'),coalesce(a.is_override,false),coalesce(t.teacher_count,0),
 case when coalesce(t.teacher_count,0)=0 then 'TEACHER_UNASSIGNED' else 'ASSIGNED' end
from universe u join public.subjects s on s.id=u.subject_id
left join public.class_subject_allocations a on a.class_id=p_class_id and a.subject_id=u.subject_id and a.academic_term_id=p_academic_term_id
left join scheduled sc on sc.subject_id=u.subject_id left join teachers t on t.subject_id=u.subject_id order by s.name;
$$;
