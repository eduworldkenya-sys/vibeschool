-- Use Scheme-persisted outcome identities as lesson assessment authority.
-- Preserve the legacy exact-body resolver only for records without saved IDs.
-- No curriculum status or KICD verification state is modified.
begin;

create or replace function public.exq_resolve_lesson_assessment_outcomes(
  p_lesson_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  caller uuid := auth.uid();
  lp public.lesson_plans%rowtype;
  sow public.scheme_of_work%rowtype;
  payload jsonb := '[]'::jsonb;
  mapped_links integer := 0;
  resolution_source text;
begin
  if caller is null then raise exception 'not_authenticated'; end if;

  select * into lp from public.lesson_plans where id = p_lesson_plan_id;
  if not found then raise exception 'lesson_plan_not_found'; end if;
  if lp.teacher_id is distinct from caller then raise exception 'lesson_plan_not_owned'; end if;
  if lp.scheme_id is null then raise exception 'lesson_plan_scheme_required'; end if;

  select * into sow from public.scheme_of_work where id = lp.scheme_id;
  if not found then raise exception 'scheme_item_not_found'; end if;
  if sow.teacher_id is distinct from caller
     or sow.school_id is distinct from lp.school_id
     or sow.class_id is distinct from lp.class_id
     or sow.subject_id is distinct from lp.subject_id
  then raise exception 'lesson_scheme_mismatch'; end if;
  if sow.curriculum_id is null and sow.sub_strand_id is null then
    raise exception 'scheme_curriculum_required';
  end if;

  select count(*) into mapped_links
  from public.scheme_lesson_outcomes slo
  where slo.scheme_lesson_id = sow.id;

  if mapped_links > 0 then
    -- A Scheme's explicit selection is authoritative. Do not silently fall back
    -- to free text if the saved selection has become inactive or invalid.
    resolution_source := 'scheme_outcome_ids';
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', clo.id,
      'outcome_text', clo.outcome_text,
      'outcome_code', clo.outcome_code,
      'status', clo.status
    ) order by clo.outcome_code nulls last, clo.outcome_text), '[]'::jsonb)
    into payload
    from public.scheme_lesson_outcomes slo
    join public.curriculum_learning_outcomes clo on clo.id = slo.curriculum_outcome_id
    where slo.scheme_lesson_id = sow.id
      and clo.status = 'active'
      and (
        (clo.sub_strand_id is not null
         and clo.sub_strand_id = sow.sub_strand_id
         and (sow.curriculum_id is null or clo.curriculum_id is null
              or clo.curriculum_id = sow.curriculum_id))
        or (clo.sub_strand_id is null and sow.curriculum_id is not null
            and clo.curriculum_id = sow.curriculum_id)
      );
  elsif sow.curriculum_outcome_id is not null then
    -- Older Scheme records may store one selected outcome directly.
    resolution_source := 'scheme_outcome_id';
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', clo.id,
      'outcome_text', clo.outcome_text,
      'outcome_code', clo.outcome_code,
      'status', clo.status
    )), '[]'::jsonb)
    into payload
    from public.curriculum_learning_outcomes clo
    where clo.id = sow.curriculum_outcome_id
      and clo.status = 'active'
      and (
        (clo.sub_strand_id is not null
         and clo.sub_strand_id = sow.sub_strand_id
         and (sow.curriculum_id is null or clo.curriculum_id is null
              or clo.curriculum_id = sow.curriculum_id))
        or (clo.sub_strand_id is null and sow.curriculum_id is not null
            and clo.curriculum_id = sow.curriculum_id)
      );
  else
    -- Compatibility only: historical Scheme records with no explicit outcomes
    -- may rely on the old saved-lesson text matching rule.
    resolution_source := 'legacy_lesson_body';
    if sow.curriculum_id is not null then
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
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lesson_plan_id', lp.id,
    'scheme_id', sow.id,
    'curriculum_id', sow.curriculum_id,
    'sub_strand_id', sow.sub_strand_id,
    'resolution_source', resolution_source,
    'outcomes', payload
  );
end;
$function$;

revoke all on function public.exq_resolve_lesson_assessment_outcomes(uuid) from public, anon;
grant execute on function public.exq_resolve_lesson_assessment_outcomes(uuid) to authenticated, service_role;
commit;
