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

  select * into lp from public.lesson_plans where id = p_lesson_plan_id;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  if lp.teacher_id is distinct from caller then raise exception 'lesson_plan_not_owned'; end if;
  if lp.scheme_id is null then raise exception 'lesson_plan_scheme_required'; end if;

  select * into sow from public.scheme_of_work where id = lp.scheme_id;
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

create or replace function public.exq_prepare_grounded_lesson_assessment(
  p_lesson_plan_id uuid,
  p_assessment_type text,
  p_request_key text,
  p_title text,
  p_generation_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  lp public.lesson_plans%rowtype;
  existing public.assessment_definitions%rowtype;
  result_id uuid;
  normalized_type text := lower(btrim(coalesce(p_assessment_type, '')));
  normalized_key text := nullif(btrim(coalesce(p_request_key, '')), '');
  generator_version text := coalesce(p_generation_metadata->>'generator_version', '');
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if normalized_type not in ('exercise', 'homework', 'quiz') then raise exception 'unsupported_grounded_lesson_assessment_type'; end if;
  if normalized_key is null then raise exception 'generation_request_key_required'; end if;
  if generator_version <> 'curriculum-outcome-assessment-v4' then raise exception 'unsupported_grounded_generator_version'; end if;

  select * into lp from public.lesson_plans where id = p_lesson_plan_id for update;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  if lp.teacher_id is distinct from caller then raise exception 'lesson_plan_not_owned'; end if;
  if lp.school_id is null or lp.class_id is null or lp.subject_id is null then raise exception 'lesson_context_required'; end if;
  if not exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = caller
      and tc.school_id = lp.school_id
      and tc.class_id = lp.class_id
      and tc.subject_id = lp.subject_id
  ) then raise exception 'teacher_not_assigned'; end if;

  perform pg_advisory_xact_lock(hashtextextended(caller::text || ':' || lp.id::text || ':' || normalized_type, 0));

  select * into existing
  from public.assessment_definitions ad
  where ad.teacher_id = caller and ad.generation_request_key = normalized_key
  limit 1;

  if found then
    if existing.lesson_plan_id is distinct from lp.id or existing.assessment_type is distinct from normalized_type then
      raise exception 'generation_request_key_conflict';
    end if;
    if existing.status not in ('draft', 'review') then
      return jsonb_build_object(
        'ok', true,
        'assessment_id', existing.id,
        'needs_generation', false,
        'generation_status', existing.generation_status,
        'status', existing.status
      );
    end if;
    if existing.generation_status = 'generated'
       and existing.generation_metadata->>'generator_version' = 'curriculum-outcome-assessment-v4'
    then
      return jsonb_build_object(
        'ok', true,
        'assessment_id', existing.id,
        'needs_generation', false,
        'generation_status', existing.generation_status,
        'status', existing.status
      );
    end if;
  else
    select * into existing
    from public.assessment_definitions ad
    where ad.teacher_id = caller
      and ad.lesson_plan_id = lp.id
      and ad.assessment_type = normalized_type
      and ad.generation_source <> 'teacher_authored'
      and ad.status in ('draft', 'review')
    order by ad.created_at desc
    limit 1;
  end if;

  if found then
    if exists (select 1 from public.assessment_assignments aa where aa.assessment_id = existing.id) then
      raise exception 'working_draft_has_assignment';
    end if;

    delete from public.assessment_items where assessment_id = existing.id;
    delete from public.assessment_sections where assessment_id = existing.id;

    update public.assessment_definitions
    set title = coalesce(nullif(btrim(coalesce(p_title, '')), ''), title),
        status = 'draft',
        total_marks = 0,
        estimated_minutes = null,
        generation_source = 'lesson_generator',
        generation_metadata = coalesce(generation_metadata, '{}'::jsonb) || coalesce(p_generation_metadata, '{}'::jsonb),
        generation_status = 'queued',
        generation_request_key = normalized_key,
        generation_started_at = null,
        generation_completed_at = null,
        generation_failed_at = null,
        generation_error_code = null,
        generation_error_message = null,
        source_lesson_updated_at = lp.updated_at,
        approved_by = null,
        approved_at = null,
        updated_at = now()
    where id = existing.id;

    return jsonb_build_object(
      'ok', true,
      'assessment_id', existing.id,
      'needs_generation', true,
      'generation_status', 'queued',
      'status', 'draft',
      'reset_existing', true
    );
  end if;

  insert into public.assessment_definitions(
    school_id, teacher_id, class_id, subject_id, lesson_plan_id,
    assessment_type, title, status, generation_source, generation_metadata,
    generation_status, generation_request_key, generation_attempt, source_lesson_updated_at
  ) values (
    lp.school_id, caller, lp.class_id, lp.subject_id, lp.id,
    normalized_type, coalesce(nullif(btrim(coalesce(p_title, '')), ''), 'Lesson assessment'),
    'draft', 'lesson_generator', coalesce(p_generation_metadata, '{}'::jsonb),
    'queued', normalized_key, 0, lp.updated_at
  ) returning id into result_id;

  return jsonb_build_object(
    'ok', true,
    'assessment_id', result_id,
    'needs_generation', true,
    'generation_status', 'queued',
    'status', 'draft',
    'reset_existing', false
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

  perform pg_advisory_xact_lock(hashtextextended(p_assessment_id::text || ':' || p_class_id::text, 0));

  select * into ad from public.assessment_definitions where id = p_assessment_id for update;
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
    return jsonb_build_object('ok', true, 'created', false, 'assignment_id', existing.id, 'status', existing.status);
  end if;

  if ad.status <> 'approved' then raise exception 'assessment_not_approved'; end if;

  assignment_id := public.exq_assign_assessment(
    p_assessment_id, p_class_id, null, null, null,
    p_time_limit_minutes, 1, false, false, p_show_score_policy
  );

  return jsonb_build_object('ok', true, 'created', true, 'assignment_id', assignment_id, 'status', 'open');
end;
$$;

revoke all on function public.exq_resolve_lesson_assessment_outcomes(uuid) from public, anon;
revoke all on function public.exq_prepare_grounded_lesson_assessment(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.exq_assign_lesson_assessment_once(uuid, uuid, integer, text) from public, anon;
grant execute on function public.exq_resolve_lesson_assessment_outcomes(uuid) to authenticated, service_role;
grant execute on function public.exq_prepare_grounded_lesson_assessment(uuid, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.exq_assign_lesson_assessment_once(uuid, uuid, integer, text) to authenticated, service_role;

commit;
