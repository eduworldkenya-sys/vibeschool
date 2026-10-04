begin;

-- VibeLearn P0 follow-up: align lesson outcome usability with the canonical
-- VibeSchool lifecycle used by Twin/adaptive learning. "active" is usable
-- without a verification claim; "verified" is also authoritative and must
-- not disappear from lesson recommendations. Draft/rejected/archived remain excluded.

CREATE OR REPLACE FUNCTION public.teacher_get_vibelearn_lesson_recommendations(p_lesson_plan_id uuid, p_limit_per_stage integer DEFAULT 3)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit_per_stage,3),1),6);
  v_class_id uuid;
  v_subject_id uuid;
  v_curriculum_id uuid;
  v_sub_strand_id uuid;
  v_outcome_count integer := 0;
  v_concept_count integer := 0;
  v_graph_misconception_count integer := 0;
  v_class_size integer := 0;
  v_support integer := 0;
  v_practice integer := 0;
  v_extend integer := 0;
  v_no_evidence integer := 0;
  v_observed_misconceptions integer := 0;
  v_recommendations jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok',false,'error','auth_required');
  end if;

  select
    lp.class_id,
    lp.subject_id,
    coalesce(sow.curriculum_id, lp.curriculum_id),
    coalesce(sow.sub_strand_id, lp.strand_id)
  into
    v_class_id,
    v_subject_id,
    v_curriculum_id,
    v_sub_strand_id
  from public.lesson_plans lp
  left join public.scheme_of_work sow on sow.id = lp.scheme_id
  where lp.id = p_lesson_plan_id;

  if not found then
    return jsonb_build_object('ok',false,'error','lesson_plan_not_found');
  end if;

  if not public.fn_content_os_target_authorized(
    'lesson_plan', null, p_lesson_plan_id, null, null, null, null, false
  ) then
    return jsonb_build_object('ok',false,'error','forbidden');
  end if;

  select count(*)::integer
  into v_outcome_count
  from public.curriculum_learning_outcomes clo
  where v_curriculum_id is not null
    and clo.curriculum_id = v_curriculum_id
    and (v_sub_strand_id is null or clo.sub_strand_id = v_sub_strand_id)
    and clo.status in ('active','verified');

  select count(distinct coc.concept_id)::integer
  into v_concept_count
  from public.curriculum_learning_outcomes clo
  join public.curriculum_outcome_concepts coc
    on coc.outcome_id = clo.id
   and coc.status = 'active'
   and coc.verified_at is not null
  join public.curriculum_concepts cc
    on cc.id = coc.concept_id
   and cc.status = 'active'
   and cc.verified_at is not null
  where v_curriculum_id is not null
    and clo.curriculum_id = v_curriculum_id
    and (v_sub_strand_id is null or clo.sub_strand_id = v_sub_strand_id)
    and clo.status in ('active','verified');

  select count(distinct cmo.misconception_id)::integer
  into v_graph_misconception_count
  from public.curriculum_learning_outcomes clo
  join public.curriculum_misconception_outcomes cmo
    on cmo.outcome_id = clo.id
  join public.curriculum_misconceptions cm
    on cm.id = cmo.misconception_id
   and cm.status = 'active'
   and cm.verified_at is not null
  where v_curriculum_id is not null
    and clo.curriculum_id = v_curriculum_id
    and (v_sub_strand_id is null or clo.sub_strand_id = v_sub_strand_id)
    and clo.status in ('active','verified');

  with lesson_outcomes as (
    select clo.id
    from public.curriculum_learning_outcomes clo
    where v_curriculum_id is not null
      and clo.curriculum_id = v_curriculum_id
      and (v_sub_strand_id is null or clo.sub_strand_id = v_sub_strand_id)
      and clo.status in ('active','verified')
  ),
  class_students as (
    select distinct sc.student_id
    from public.student_classes sc
    where sc.class_id = v_class_id
      and sc.is_current = true
  ),
  learner_state as (
    select
      cs.student_id,
      avg(som.mastery_score) filter (
        where som.evidence_count > 0 and som.mastery_score is not null
      ) as mastery_score,
      coalesce(sum(som.evidence_count) filter (where som.evidence_count > 0),0) as evidence_count
    from class_students cs
    left join public.student_outcome_mastery som
      on som.student_id = cs.student_id
     and som.outcome_id in (select id from lesson_outcomes)
    group by cs.student_id
  )
  select
    count(*)::integer,
    count(*) filter (where evidence_count > 0 and mastery_score < 55)::integer,
    count(*) filter (where evidence_count > 0 and mastery_score >= 55 and mastery_score < 70)::integer,
    count(*) filter (where evidence_count > 0 and mastery_score >= 70)::integer,
    count(*) filter (where evidence_count = 0)::integer
  into v_class_size, v_support, v_practice, v_extend, v_no_evidence
  from learner_state;

  select count(distinct stmc.student_id)::integer
  into v_observed_misconceptions
  from public.student_twin_memory_claims stmc
  where stmc.memory_type = 'misconception'
    and stmc.status = 'active'
    and stmc.outcome_id in (
      select clo.id
      from public.curriculum_learning_outcomes clo
      where v_curriculum_id is not null
        and clo.curriculum_id = v_curriculum_id
        and (v_sub_strand_id is null or clo.sub_strand_id = v_sub_strand_id)
        and clo.status in ('active','verified')
    );

  with lesson_outcomes as (
    select clo.id
    from public.curriculum_learning_outcomes clo
    where v_curriculum_id is not null
      and clo.curriculum_id = v_curriculum_id
      and (v_sub_strand_id is null or clo.sub_strand_id = v_sub_strand_id)
      and clo.status in ('active','verified')
  ),
  candidate as (
    select
      lr.id as resource_id,
      lr.title,
      lr.description,
      lr.asset_kind,
      lr.purpose,
      coalesce(lr.material_variant, lr.asset_kind, 'content') as representation,
      lr.publication_id,
      lr.chapter_id,
      lr.content_id,
      exists (
        select 1
        from public.learning_resource_versions lrv
        where lrv.resource_id = lr.id
          and lrv.lifecycle_status = 'certified'
      ) as certified,
      exists (
        select 1
        from public.learning_product_items lpi
        join public.learning_product_concept_links lpcl
          on lpcl.product_id = lpi.product_id
        join public.curriculum_outcome_concepts coc
          on coc.concept_id = lpcl.concept_id
         and coc.status = 'active'
         and coc.verified_at is not null
        join public.curriculum_concepts cc
          on cc.id = coc.concept_id
         and cc.status = 'active'
         and cc.verified_at is not null
        where lpi.learning_resource_id = lr.id
          and coc.outcome_id in (select id from lesson_outcomes)
      ) as graph_match,
      exists (
        select 1
        from public.learning_product_items lpi
        join public.learning_product_misconception_links lpml
          on lpml.product_id = lpi.product_id
        join public.curriculum_misconception_outcomes cmo
          on cmo.misconception_id = lpml.misconception_id
        join public.curriculum_misconceptions cm
          on cm.id = cmo.misconception_id
         and cm.status = 'active'
         and cm.verified_at is not null
        where lpi.learning_resource_id = lr.id
          and cmo.outcome_id in (select id from lesson_outcomes)
      ) as misconception_match,
      exists (
        select 1
        from public.teaching_resource_links trl
        where trl.target_type = 'lesson_plan'
          and trl.lesson_plan_id = p_lesson_plan_id
          and trl.resource_id = lr.id
      ) as already_attached,
      (
        case when v_sub_strand_id is not null and lr.sub_strand_id = v_sub_strand_id then 120 else 0 end +
        case when v_curriculum_id is not null and lr.curriculum_id = v_curriculum_id then 90 else 0 end +
        case when lr.subject_id = v_subject_id then 35 else 0 end +
        case when exists (
          select 1 from public.learning_resource_versions lrv
          where lrv.resource_id = lr.id and lrv.lifecycle_status = 'certified'
        ) then 20 else 0 end
      )::integer as authority_score
    from public.learning_resources lr
    where lr.status = 'active'
      and public.fn_learning_resource_visible(lr.id)
      and coalesce(lr.asset_kind,'') <> 'lesson_plan'
      and (lr.subject_id is null or lr.subject_id = v_subject_id)
      and (
        (v_sub_strand_id is not null and lr.sub_strand_id = v_sub_strand_id)
        or (v_curriculum_id is not null and lr.curriculum_id = v_curriculum_id)
        or lr.subject_id = v_subject_id
      )
  ),
  staged as (
    select c.*, x.stage, x.stage_order, x.usage_role, x.stage_score
    from candidate c
    cross join lateral (
      values
        ('introduce',1,'before_class',
          case when c.asset_kind in ('learner_notes','teacher_notes','content_block') then 35 else 5 end),
        ('explain',2,'reference',
          case when c.asset_kind in ('teacher_notes','learner_notes','content_block','revision') then 35 else 5 end),
        ('demonstrate',3,'in_class',
          case when c.asset_kind in ('worked_example','practical') then 45 else
               case when c.representation in ('visual_explainer','worked_examples','story_mode') then 35 else 0 end end),
        ('check',4,'assessment_source',
          case when c.asset_kind in ('quiz','assessment','rubric') then 45 else 0 end),
        ('practice',5,'after_class',
          case when c.asset_kind in ('exercise','worksheet','quiz') then 45 else 0 end),
        ('support',6,'revision_source',
          case when c.asset_kind in ('remedial','revision','worked_example') then 50 else
               case when c.misconception_match then 40 else 0 end end),
        ('extend',7,'after_class',
          case when c.asset_kind in ('enrichment','project','practical') then 50 else 0 end),
        ('homework',8,'homework_source',
          case when c.asset_kind in ('homework','worksheet','exercise') then 45 else 0 end)
    ) as x(stage,stage_order,usage_role,stage_score)
    where x.stage_score > 0
  ),
  ranked as (
    select
      s.*,
      (s.authority_score + s.stage_score +
        case when s.graph_match then 35 else 0 end +
        case when s.misconception_match and s.stage='support' then 30 else 0 end
      ) as score,
      row_number() over (
        partition by s.stage
        order by
          (s.authority_score + s.stage_score +
            case when s.graph_match then 35 else 0 end +
            case when s.misconception_match and s.stage='support' then 30 else 0 end
          ) desc,
          s.certified desc,
          s.title,
          s.resource_id
      ) as rn
    from staged s
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'stage',r.stage,
      'stage_order',r.stage_order,
      'usage_role',r.usage_role,
      'resource_id',r.resource_id,
      'title',r.title,
      'description',r.description,
      'asset_kind',r.asset_kind,
      'representation',r.representation,
      'publication_id',r.publication_id,
      'chapter_id',r.chapter_id,
      'content_id',r.content_id,
      'certified',r.certified,
      'graph_match',r.graph_match,
      'misconception_match',r.misconception_match,
      'already_attached',r.already_attached,
      'score',r.score,
      'reason',
        case
          when r.misconception_match and r.stage='support' then 'Matches a verified misconception path for this lesson.'
          when r.graph_match then 'Matches a verified concept in this lesson.'
          when v_sub_strand_id is not null then 'Matches this lesson sub-strand and teaching purpose.'
          when v_curriculum_id is not null then 'Matches this lesson curriculum and teaching purpose.'
          else 'Matches this subject and teaching purpose.'
        end
    ) order by r.stage_order,r.score desc,r.title),'[]'::jsonb)
  into v_recommendations
  from ranked r
  where r.rn <= v_limit;

  return jsonb_build_object(
    'ok',true,
    'lesson_plan_id',p_lesson_plan_id,
    'authority',jsonb_build_object(
      'class_id',v_class_id,
      'subject_id',v_subject_id,
      'curriculum_id',v_curriculum_id,
      'sub_strand_id',v_sub_strand_id,
      'outcome_count',v_outcome_count,
      'verified_concept_count',v_concept_count,
      'verified_graph_misconception_count',v_graph_misconception_count,
      'graph_is_enrichment_not_invention',true
    ),
    'differentiation',jsonb_build_object(
      'class_size',v_class_size,
      'needs_support',v_support,
      'needs_practice',v_practice,
      'ready_to_extend',v_extend,
      'no_evidence',v_no_evidence,
      'learners_with_observed_misconceptions',v_observed_misconceptions,
      'teacher_controls_assignment',true,
      'missing_evidence_is_not_weakness',true
    ),
    'recommendations',v_recommendations
  );
end;
$function$
;

revoke all on function public.teacher_get_vibelearn_lesson_recommendations(uuid,integer)
  from public, anon;
grant execute on function public.teacher_get_vibelearn_lesson_recommendations(uuid,integer)
  to authenticated, service_role;

comment on function public.teacher_get_vibelearn_lesson_recommendations(uuid,integer) is
'Teacher-controlled VibeLearn lesson sequence projection. Uses active or verified curriculum outcomes, canonical resource authority, verified semantic graph when available, and recorded learner evidence without inventing weakness.';

commit;
