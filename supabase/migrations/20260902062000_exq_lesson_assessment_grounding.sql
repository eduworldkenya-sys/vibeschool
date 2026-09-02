begin;

create or replace function public.exq_resolve_lesson_assessment_outcomes(
  p_lesson_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  lp public.lesson_plans%rowtype;
  sow public.scheme_of_work%rowtype;
  payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select * into lp
  from public.lesson_plans
  where id = p_lesson_plan_id;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  if lp.teacher_id is distinct from caller then raise exception 'lesson_plan_not_owned'; end if;
  if lp.scheme_id is null then raise exception 'lesson_plan_scheme_required'; end if;

  select * into sow
  from public.scheme_of_work
  where id = lp.scheme_id;
  if not found then raise exception 'scheme_item_not_found'; end if;
  if sow.teacher_id is distinct from caller
     or sow.class_id is distinct from lp.class_id
     or sow.subject_id is distinct from lp.subject_id
  then raise exception 'lesson_scheme_mismatch'; end if;
  if sow.curriculum_id is null then raise exception 'scheme_curriculum_required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', clo.id,
    'outcome_text', clo.outcome_text,
    'outcome_code', clo.outcome_code,
    'status', clo.status
  ) order by clo.outcome_code nulls last, clo.outcome_text), '[]'::jsonb)
  into payload
  from public.curriculum_learning_outcomes clo
  where clo.curriculum_id = sow.curriculum_id
    and clo.status <> 'retired'
    and lp.body is not null
    and position(clo.outcome_text in lp.body) > 0;

  return jsonb_build_object(
    'ok', true,
    'lesson_plan_id', lp.id,
    'scheme_id', sow.id,
    'curriculum_id', sow.curriculum_id,
    'outcomes', payload
  );
end;
$$;

create or replace function public.exq_assign_lesson_assessment_once(
  p_assessment_id uuid,
  p_class_id uuid,
  p_time_limit_minutes integer default null,
  p_show_score_policy text default 'after_review'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  ad public.assessment_definitions%rowtype;
  existing public.assessment_assignments%rowtype;
  assignment_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_assessment_id::text || ':' || p_class_id::text, 0)
  );

  select * into ad
  from public.assessment_definitions
  where id = p_assessment_id
  for update;
  if not found then raise exception 'assessment_not_found'; end if;
  if ad.teacher_id is distinct from caller then raise exception 'assessment_not_owned'; end if;
  if ad.lesson_plan_id is null then raise exception 'lesson_assessment_required'; end if;
  if ad.class_id is distinct from p_class_id then raise exception 'assessment_class_mismatch'; end if;

  select * into existing
  from public.assessment_assignments
  where assessment_id = p_assessment_id
    and class_id = p_class_id
    and target_group_id is null
    and status in ('assigned', 'open')
  order by assigned_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'assignment_id', existing.id,
      'status', existing.status
    );
  end if;

  if ad.status <> 'approved' then raise exception 'assessment_not_approved'; end if;

  assignment_id := public.exq_assign_assessment(
    p_assessment_id,
    p_class_id,
    null,
    null,
    null,
    p_time_limit_minutes,
    1,
    false,
    false,
    p_show_score_policy
  );

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'assignment_id', assignment_id,
    'status', 'open'
  );
end;
$$;

revoke all on function public.exq_resolve_lesson_assessment_outcomes(uuid) from public, anon;
revoke all on function public.exq_assign_lesson_assessment_once(uuid, uuid, integer, text) from public, anon;
grant execute on function public.exq_resolve_lesson_assessment_outcomes(uuid) to authenticated, service_role;
grant execute on function public.exq_assign_lesson_assessment_once(uuid, uuid, integer, text) to authenticated, service_role;

commit;
