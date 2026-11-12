begin;

create or replace function
public.resolve_class_weekly_baseline(
  p_class_id uuid,
  p_subject_id uuid
)
returns public.subject_weekly_allocations
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_grade text;
  v_global_subject_id uuid;
  v_school_id uuid;
  v_count integer;
  v_result public.subject_weekly_allocations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select
    c.grade_code,
    coalesce(s.global_subject_id, s.id),
    c.school_id
  into
    v_grade,
    v_global_subject_id,
    v_school_id
  from public.classes c
  join public.subjects s
    on s.id = p_subject_id
   and (
     s.school_id = c.school_id
     or s.school_id is null
   )
  where c.id = p_class_id;

  if not found then
    raise exception 'CLASS_SUBJECT_MISMATCH';
  end if;

  if not public.is_active_school_member(v_school_id) then
    raise exception 'SCHOOL_ACCESS_DENIED';
  end if;

  if v_grade is null then
    raise exception 'GRADE_IDENTITY_REQUIRED';
  end if;

  select coalesce(
  (
    select a.baseline_subject_id
    from public.timetable_allocation_subject_aliases a
    where a.grade_code = v_grade
      and a.subject_id = v_global_subject_id
  ),
  v_global_subject_id
)
into v_global_subject_id;

  select count(*)
  into v_count
  from public.subject_weekly_allocations swa
  where swa.grade = v_grade
    and swa.global_subject_id = v_global_subject_id;

  if v_count > 1 then
    raise exception 'AMBIGUOUS_NATIONAL_ALLOCATION';
  end if;

  select * into v_result
  from public.subject_weekly_allocations swa
  where swa.grade = v_grade
    and swa.global_subject_id = v_global_subject_id;

  return v_result;
end;
$$;

revoke all on function
  public.resolve_class_weekly_baseline(uuid, uuid)
  from public, anon;

grant execute on function
  public.resolve_class_weekly_baseline(uuid, uuid)
  to authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_class_subject_allocations(p_school_id uuid, p_academic_term_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_term public.academic_terms%rowtype;
  v_upserted integer := 0;
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id) then
    raise exception 'SCHOOL_ADMIN_REQUIRED';
  end if;

  select * into v_term
  from public.academic_terms
  where id = p_academic_term_id and school_id = p_school_id;
  if not found then raise exception 'ACADEMIC_TERM_NOT_FOUND'; end if;

  -- Legacy reconciliation only: derive known offerings from teacher assignments.
  -- New class setup writes canonical allocation rows directly, allowing teacher_id to remain unassigned.
  insert into public.class_subject_allocations (
    school_id, class_id, subject_id, academic_term_id,
    baseline_allocation_id, baseline_units_per_week, effective_units_per_week,
    source, is_override, effective_from, effective_until, updated_at
  )
  select distinct
    tc.school_id, tc.class_id, tc.subject_id, v_term.id,
    swa.id, swa.lessons_per_week::numeric, swa.lessons_per_week::numeric,
    case when swa.id is null then 'UNKNOWN' else 'KICD' end,
    false, v_term.start_date, v_term.end_date, now()
  from public.teacher_classes tc
  join public.classes c on c.id = tc.class_id
  join public.subjects s on s.id = tc.subject_id
  left join lateral public.resolve_class_weekly_baseline(tc.class_id, tc.subject_id) swa on true
  where tc.school_id = p_school_id
  on conflict (class_id, subject_id, academic_term_id) do update
  set baseline_allocation_id = excluded.baseline_allocation_id,
      baseline_units_per_week = excluded.baseline_units_per_week,
      effective_units_per_week = case when public.class_subject_allocations.is_override then public.class_subject_allocations.effective_units_per_week else excluded.effective_units_per_week end,
      source = case when public.class_subject_allocations.is_override then public.class_subject_allocations.source else excluded.source end,
      effective_from = excluded.effective_from,
      effective_until = excluded.effective_until,
      updated_at = now();
  get diagnostics v_upserted = row_count;
  return jsonb_build_object('school_id', p_school_id, 'academic_term_id', p_academic_term_id, 'reconciled', v_upserted);
end;
$function$


CREATE OR REPLACE FUNCTION public.set_class_subject_allocation(p_class_id uuid, p_subject_id uuid, p_academic_term_id uuid, p_effective_units_per_week numeric DEFAULT NULL::numeric, p_override_reason text DEFAULT NULL::text)
 RETURNS class_subject_allocations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_class public.classes%rowtype;
  v_term public.academic_terms%rowtype;
  v_subject public.subjects%rowtype;
  v_baseline public.subject_weekly_allocations%rowtype;
  v_units numeric;
  v_override boolean;
  v_source text;
  v_row public.class_subject_allocations%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_class from public.classes where id=p_class_id;
  if not found or v_class.school_id is null then raise exception 'CLASS_NOT_FOUND'; end if;

  if not public.is_school_admin(v_class.school_id)
     and coalesce(v_class.teacher_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid() then
    raise exception 'ALLOCATION_WRITE_FORBIDDEN';
  end if;

  select * into v_term from public.academic_terms where id=p_academic_term_id and school_id=v_class.school_id;
  if not found then raise exception 'ACADEMIC_TERM_NOT_FOUND'; end if;
  select * into v_subject from public.subjects where id=p_subject_id and (school_id=v_class.school_id or school_id is null);
  if not found then raise exception 'SUBJECT_NOT_FOUND'; end if;

  select * into v_baseline
  from public.resolve_class_weekly_baseline(p_class_id, p_subject_id);

  if p_effective_units_per_week is null then
    if v_baseline.id is null then raise exception 'ALLOCATION_BASELINE_UNKNOWN'; end if;
    v_units := v_baseline.lessons_per_week;
    v_override := false;
    v_source := 'KICD';
  else
    if p_effective_units_per_week <= 0 then raise exception 'INVALID_ALLOCATION_UNITS'; end if;
    v_units := p_effective_units_per_week;
    v_override := v_baseline.id is null or p_effective_units_per_week <> v_baseline.lessons_per_week;
    if v_override and nullif(btrim(p_override_reason),'') is null then raise exception 'OVERRIDE_REASON_REQUIRED'; end if;
    v_source := case when v_override then 'SCHOOL_OVERRIDE' else 'KICD' end;
  end if;

  insert into public.class_subject_allocations(
    school_id,class_id,subject_id,academic_term_id,
    baseline_allocation_id,baseline_units_per_week,effective_units_per_week,
    source,is_override,override_reason,approved_by,effective_from,effective_until,updated_at
  ) values (
    v_class.school_id,p_class_id,p_subject_id,p_academic_term_id,
    v_baseline.id,v_baseline.lessons_per_week,v_units,
    v_source,v_override,case when v_override then p_override_reason else null end,
    auth.uid(),v_term.start_date,v_term.end_date,now()
  )
  on conflict(class_id,subject_id,academic_term_id) do update set
    baseline_allocation_id=excluded.baseline_allocation_id,
    baseline_units_per_week=excluded.baseline_units_per_week,
    effective_units_per_week=excluded.effective_units_per_week,
    source=excluded.source,is_override=excluded.is_override,
    override_reason=excluded.override_reason,approved_by=excluded.approved_by,
    effective_from=excluded.effective_from,effective_until=excluded.effective_until,updated_at=now()
  returning * into v_row;
  return v_row;
end;
$function$


create or replace function
public.get_teacher_weekly_timetable_load()
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
set search_path = 'public', 'pg_temp'
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_week_start date :=
    date_trunc(
      'week', now() at time zone 'Africa/Nairobi'
    )::date;
  v_week_end date := v_week_start + 6;
begin
  if v_teacher_id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  return query
  with assignments as (
    select
      tc.school_id,
      tc.class_id,
      tc.subject_id,
      c.name as c_name,
      c.stream as c_stream,
      c.grade_code,
      s.name as s_name,
      coalesce(s.global_subject_id, s.id) as global_id
    from public.teacher_classes tc
    join public.classes c
      on c.id = tc.class_id
     and c.school_id = tc.school_id
    join public.subjects s
      on s.id = tc.subject_id
    where tc.teacher_id = v_teacher_id
  ),
  term_context as (
    select
      a.*,
      t.id as term_id
    from assignments a
    left join lateral (
      select at.id
      from public.academic_terms at
      where at.school_id = a.school_id
        and at.start_date <= v_week_end
        and at.end_date >= v_week_start
      order by at.start_date desc
      limit 1
    ) t on true
  ),
  targets as (
    select
      a.*,
      coalesce(
        csa.effective_units_per_week,
        swa.units
      ) as required_units
    from term_context a
    left join public.class_subject_allocations csa
      on csa.class_id = a.class_id
     and csa.subject_id = a.subject_id
     and csa.academic_term_id = a.term_id
    left join lateral (
      select min(b.lessons_per_week)::numeric as units
      from public.subject_weekly_allocations b
      where b.grade = a.grade_code
        and b.global_subject_id = coalesce(
          (select alias.baseline_subject_id
           from public.timetable_allocation_subject_aliases alias
           where alias.grade_code = a.grade_code and alias.subject_id = a.global_id),
          a.global_id)
      having count(*) = 1
    ) swa on true
  ),
  scheduled as (
    select
      a.class_id,
      a.subject_id,
      coalesce(sum(ts.allocation_units), 0)::numeric
        as actual_units
    from assignments a
    left join public.timetable_slots ts
      on ts.school_id = a.school_id
     and ts.teacher_id = v_teacher_id
     and ts.class_id = a.class_id
     and ts.subject_id = a.subject_id
     and ts.recurrence_pattern = 'EVERY_WEEK'
     and ts.effective_from <=
       v_week_start + (ts.day_of_week - 1)
     and (
       ts.effective_until is null
       or ts.effective_until >=
          v_week_start + (ts.day_of_week - 1)
     )
    group by a.class_id, a.subject_id
  )
  select
    t.class_id,
    t.subject_id,
    t.c_name,
    coalesce(t.c_stream, ''),
    t.s_name,
    t.grade_code,
    t.required_units,
    coalesce(sc.actual_units, 0),
    case
      when t.grade_code is null
        or t.term_id is null
        or t.required_units is null
      then 'NO_TARGET'
      when coalesce(sc.actual_units, 0) = 0
      then 'ZERO'
      when sc.actual_units < t.required_units
      then 'UNDER'
      when sc.actual_units > t.required_units
      then 'OVER'
      else 'OK'
    end
  from targets t
  left join scheduled sc
    on sc.class_id = t.class_id
   and sc.subject_id = t.subject_id
  order by t.c_name, t.c_stream, t.s_name;
end;
$$;

revoke all on function
  public.get_teacher_weekly_timetable_load()
  from public, anon;

grant execute on function
  public.get_teacher_weekly_timetable_load()
  to authenticated;

commit;
