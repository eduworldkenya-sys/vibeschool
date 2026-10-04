begin;

-- VibeLearn learner remediation resource recommendations.
--
-- This is deliberately separate from commercial learning_products. A learner
-- may need curriculum-grounded support even when there is no saleable product.
-- Recommendations require recorded learner evidence and an exact curriculum or
-- sub-strand match, and they only expose resources the learner is authorized to
-- see. Missing evidence is never converted into weakness.

create or replace function public.student_get_vibelearn_resource_recommendations(
  p_limit integer default 6
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_student_id uuid;
  v_student_count integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit,6),1),12);
  v_rows jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  select count(*)::integer,min(s.id)
  into v_student_count,v_student_id
  from public.students s
  where s.profile_id=v_uid
    and s.deleted_at is null;

  if v_student_count=0 then
    raise exception 'learner_identity_not_found';
  end if;
  if v_student_count<>1 then
    raise exception 'ambiguous_learner_identity';
  end if;

  with weak_outcomes as (
    select
      som.outcome_id,
      som.mastery_score,
      som.evidence_count,
      som.last_evidence_at,
      clo.outcome_text,
      clo.outcome_code,
      clo.curriculum_id,
      clo.sub_strand_id,
      case when som.mastery_score < 55 then 'support' else 'practice' end as recommendation_mode,
      greatest(0,100-coalesce(som.mastery_score,0))::numeric as need_weight
    from public.student_outcome_mastery som
    join public.curriculum_learning_outcomes clo
      on clo.id=som.outcome_id
     and clo.status in ('active','verified')
    where som.student_id=v_student_id
      and som.mastery_score is not null
      and som.mastery_score < 70
      and som.evidence_count > 0
  ),
  candidates as (
    select
      wo.outcome_id,
      wo.outcome_text,
      wo.outcome_code,
      wo.mastery_score,
      wo.evidence_count,
      wo.last_evidence_at,
      wo.recommendation_mode,
      lr.id as resource_id,
      lr.title,
      lr.description,
      lr.asset_kind,
      lr.purpose,
      coalesce(lr.material_variant,lr.asset_kind,'content') as representation,
      lr.publication_id,
      lr.chapter_id,
      lr.content_id,
      case
        when lr.publication_id is not null and lr.chapter_id is not null
          then '/read/textbook/'||lr.publication_id::text||'/'||lr.chapter_id::text
        when lr.publication_id is not null
          then '/read/textbook/'||lr.publication_id::text
        else null
      end as action_url,
      exists(
        select 1
        from public.learning_resource_versions lrv
        where lrv.resource_id=lr.id
          and lrv.lifecycle_status='certified'
      ) as certified,
      (
        wo.need_weight
        + case when wo.sub_strand_id is not null and lr.sub_strand_id=wo.sub_strand_id then 120 else 0 end
        + case when wo.curriculum_id is not null and lr.curriculum_id=wo.curriculum_id then 90 else 0 end
        + case
            when wo.recommendation_mode='support' and lr.purpose='remediate' then 45
            when wo.recommendation_mode='practice' and lr.purpose='practise' then 40
            when lr.purpose='teach' then 20
            when lr.purpose='revise' then 15
            else 0
          end
        + case when exists(
            select 1
            from public.learning_resource_versions lrv
            where lrv.resource_id=lr.id and lrv.lifecycle_status='certified'
          ) then 20 else 0 end
      )::numeric as score
    from weak_outcomes wo
    join public.learning_resources lr
      on lr.status='active'
     and public.fn_learning_resource_visible(lr.id)
     and (
       (wo.sub_strand_id is not null and lr.sub_strand_id=wo.sub_strand_id)
       or (wo.curriculum_id is not null and lr.curriculum_id=wo.curriculum_id)
     )
    where coalesce(lr.asset_kind,'') <> 'lesson_plan'
  ),
  ranked as (
    select
      c.*,
      row_number() over(
        partition by c.outcome_id
        order by c.score desc,c.certified desc,c.title,c.resource_id
      ) as outcome_rank
    from candidates c
  ),
  limited as (
    select *
    from ranked
    where outcome_rank<=2
    order by score desc,evidence_count desc,title
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'resource_id',r.resource_id,
        'title',r.title,
        'description',r.description,
        'asset_kind',r.asset_kind,
        'purpose',r.purpose,
        'representation',r.representation,
        'publication_id',r.publication_id,
        'chapter_id',r.chapter_id,
        'content_id',r.content_id,
        'action_url',r.action_url,
        'certified',r.certified,
        'outcome_id',r.outcome_id,
        'outcome_code',r.outcome_code,
        'outcome_text',r.outcome_text,
        'mastery_score',r.mastery_score,
        'evidence_count',r.evidence_count,
        'last_evidence_at',r.last_evidence_at,
        'mode',r.recommendation_mode,
        'reason_code','recorded_outcome_weakness_exact_curriculum_match',
        'score',round(r.score,2)
      )
      order by r.score desc,r.evidence_count desc,r.title
    ),
    '[]'::jsonb
  )
  into v_rows
  from limited r;

  return jsonb_build_object(
    'ok',true,
    'student_id',v_student_id,
    'evidence_policy',jsonb_build_object(
      'requires_recorded_mastery',true,
      'minimum_evidence_count',1,
      'mastery_threshold',70,
      'support_threshold',55,
      'missing_data_is_not_weakness',true,
      'exact_curriculum_match_required',true,
      'visibility_authority_enforced',true,
      'commerce_not_required',true
    ),
    'recommendations',v_rows
  );
end;
$function$;

revoke all on function public.student_get_vibelearn_resource_recommendations(integer)
  from public,anon;
grant execute on function public.student_get_vibelearn_resource_recommendations(integer)
  to authenticated,service_role;

commit;
