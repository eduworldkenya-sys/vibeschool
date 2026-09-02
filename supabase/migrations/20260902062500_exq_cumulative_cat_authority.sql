begin;

create or replace function public.exq_resolve_cumulative_cat_outcomes(
  p_seed_lesson_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  seed public.lesson_plans%rowtype;
  seed_scheme public.scheme_of_work%rowtype;
  effective_term integer;
  payload jsonb;
  completed_lessons integer;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select * into seed from public.lesson_plans where id = p_seed_lesson_plan_id;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  if seed.teacher_id is distinct from caller then raise exception 'lesson_plan_not_owned'; end if;
  if seed.class_id is null or seed.subject_id is null then raise exception 'lesson_context_required'; end if;
  if seed.scheme_id is null then raise exception 'lesson_plan_scheme_required'; end if;

  select * into seed_scheme from public.scheme_of_work where id = seed.scheme_id;
  if not found then raise exception 'scheme_item_not_found'; end if;
  if seed_scheme.teacher_id is distinct from caller
     or seed_scheme.class_id is distinct from seed.class_id
     or seed_scheme.subject_id is distinct from seed.subject_id
  then raise exception 'lesson_scheme_mismatch'; end if;

  effective_term := coalesce(seed.term, seed_scheme.term);
  if effective_term is null then raise exception 'cat_term_authority_required'; end if;

  with completed as (
    select distinct lp.id, lp.body, lp.scheme_id
    from public.lesson_plans lp
    join public.scheme_of_work sow on sow.id = lp.scheme_id
    join public.teaching_occurrences occ
      on occ.timetable_slot_id = lp.timetable_slot_id
     and occ.occurrence_date = lp.taught_date
     and occ.teacher_id = lp.teacher_id
     and occ.class_id = lp.class_id
     and occ.subject_id = lp.subject_id
     and occ.lifecycle = 'completed'
    where lp.teacher_id = caller
      and lp.class_id = seed.class_id
      and lp.subject_id = seed.subject_id
      and coalesce(lp.term, sow.term) = effective_term
  ), resolved as (
    select distinct clo.id, clo.outcome_text, clo.outcome_code, clo.status
    from completed c
    join public.scheme_of_work sow on sow.id = c.scheme_id
    join public.curriculum_learning_outcomes clo
      on clo.curriculum_id = sow.curriculum_id
     and clo.status <> 'retired'
    where c.body is not null
      and position(clo.outcome_text in c.body) > 0
  )
  select
    (select count(*) from completed),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'outcome_text', r.outcome_text,
      'outcome_code', r.outcome_code,
      'status', r.status
    ) order by r.outcome_code nulls last, r.outcome_text), '[]'::jsonb)
  into completed_lessons, payload
  from resolved r;

  return jsonb_build_object(
    'ok', true,
    'seed_lesson_plan_id', seed.id,
    'class_id', seed.class_id,
    'subject_id', seed.subject_id,
    'term', effective_term,
    'completed_lesson_count', coalesce(completed_lessons, 0),
    'outcomes', payload
  );
end;
$$;

create or replace function public.exq_prepare_certified_cat_assessment(
  p_seed_lesson_plan_id uuid,
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
  seed public.lesson_plans%rowtype;
  truth jsonb;
  completed_count integer;
  outcome_count integer;
  effective_term integer;
  existing public.assessment_definitions%rowtype;
  result_id uuid;
  normalized_key text := nullif(btrim(coalesce(p_request_key, '')), '');
  generator_version text := coalesce(p_generation_metadata->>'generator_version', '');
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if normalized_key is null then raise exception 'generation_request_key_required'; end if;
  if generator_version <> 'curriculum-outcome-cat-v1' then raise exception 'unsupported_cat_generator_version'; end if;

  select * into seed from public.lesson_plans where id = p_seed_lesson_plan_id for update;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  if seed.teacher_id is distinct from caller then raise exception 'lesson_plan_not_owned'; end if;
  if seed.school_id is null or seed.class_id is null or seed.subject_id is null then raise exception 'lesson_context_required'; end if;
  if not exists (
    select 1 from public.teacher_classes tc
    where tc.teacher_id = caller
      and tc.school_id = seed.school_id
      and tc.class_id = seed.class_id
      and tc.subject_id = seed.subject_id
  ) then raise exception 'teacher_not_assigned'; end if;

  truth := public.exq_resolve_cumulative_cat_outcomes(p_seed_lesson_plan_id);
  completed_count := coalesce((truth->>'completed_lesson_count')::integer, 0);
  outcome_count := jsonb_array_length(coalesce(truth->'outcomes', '[]'::jsonb));
  effective_term := (truth->>'term')::integer;
  if completed_count < 2 then raise exception 'cat_requires_multiple_completed_lessons'; end if;
  if outcome_count < 2 then raise exception 'cat_requires_multiple_taught_outcomes'; end if;

  perform pg_advisory_xact_lock(hashtextextended(caller::text || ':' || seed.class_id::text || ':' || seed.subject_id::text || ':' || effective_term::text || ':cat', 0));

  select * into existing
  from public.assessment_definitions ad
  where ad.teacher_id = caller and ad.generation_request_key = normalized_key
  limit 1;

  if found then
    if existing.class_id is distinct from seed.class_id
       or existing.subject_id is distinct from seed.subject_id
       or existing.assessment_type <> 'test'
    then raise exception 'generation_request_key_conflict'; end if;

    if existing.status not in ('draft', 'review') then
      return jsonb_build_object('ok', true, 'assessment_id', existing.id, 'needs_generation', false, 'generation_status', existing.generation_status, 'status', existing.status);
    end if;
    if existing.generation_status = 'generated'
       and existing.generation_metadata->>'generator_version' = 'curriculum-outcome-cat-v1'
    then
      return jsonb_build_object('ok', true, 'assessment_id', existing.id, 'needs_generation', false, 'generation_status', existing.generation_status, 'status', existing.status);
    end if;
    if existing.generation_status = 'generating'
       and existing.generation_started_at is not null
       and existing.generation_started_at > now() - interval '2 minutes'
    then raise exception 'assessment_generation_in_progress'; end if;
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
        generation_status = 'generating',
        generation_started_at = now(),
        generation_completed_at = null,
        generation_failed_at = null,
        generation_error_code = null,
        generation_error_message = null,
        approved_by = null,
        approved_at = null,
        source_lesson_updated_at = seed.updated_at,
        updated_at = now()
    where id = existing.id;

    return jsonb_build_object('ok', true, 'assessment_id', existing.id, 'needs_generation', true, 'generation_status', 'generating', 'status', 'draft');
  end if;

  insert into public.assessment_definitions(
    school_id, teacher_id, class_id, subject_id, lesson_plan_id,
    assessment_type, title, status, generation_source, generation_metadata,
    generation_status, generation_request_key, generation_attempt,
    generation_started_at, source_lesson_updated_at
  ) values (
    seed.school_id, caller, seed.class_id, seed.subject_id, null,
    'test', coalesce(nullif(btrim(coalesce(p_title, '')), ''), 'CAT'),
    'draft', 'lesson_generator', coalesce(p_generation_metadata, '{}'::jsonb),
    'generating', normalized_key, 0, now(), seed.updated_at
  ) returning id into result_id;

  return jsonb_build_object('ok', true, 'assessment_id', result_id, 'needs_generation', true, 'generation_status', 'generating', 'status', 'draft');
end;
$$;

create or replace function public.exq_assign_grounded_assessment_once(
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
  if ad.class_id is distinct from p_class_id then raise exception 'assessment_class_mismatch'; end if;
  if ad.generation_source = 'teacher_authored' then raise exception 'grounded_assessment_required'; end if;
  if ad.generation_status <> 'generated' then raise exception 'assessment_generation_incomplete'; end if;
  if not exists (select 1 from public.assessment_items ai where ai.assessment_id = ad.id and ai.status <> 'retired') then
    raise exception 'assessment_has_no_items';
  end if;

  if exists (
    select 1 from public.assessment_items ai
    where ai.assessment_id = ad.id
      and ai.status <> 'retired'
      and not exists (
        select 1 from public.assessment_item_outcomes aio
        where aio.assessment_item_id = ai.id
      )
  ) then raise exception 'assessment_item_outcome_lineage_required'; end if;

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

revoke all on function public.exq_resolve_cumulative_cat_outcomes(uuid) from public, anon;
revoke all on function public.exq_prepare_certified_cat_assessment(uuid, text, text, jsonb) from public, anon;
revoke all on function public.exq_assign_grounded_assessment_once(uuid, uuid, integer, text) from public, anon;
grant execute on function public.exq_resolve_cumulative_cat_outcomes(uuid) to authenticated, service_role;
grant execute on function public.exq_prepare_certified_cat_assessment(uuid, text, text, jsonb) to authenticated, service_role;
grant execute on function public.exq_assign_grounded_assessment_once(uuid, uuid, integer, text) to authenticated, service_role;

commit;
