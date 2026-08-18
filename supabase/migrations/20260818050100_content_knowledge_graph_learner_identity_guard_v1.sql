begin;

create or replace function public.student_get_learning_product_recommendations(p_limit integer default 5)
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
  v_limit integer := least(greatest(coalesce(p_limit,5),1),10);
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  select count(*)::integer,min(s.id)
  into v_student_count,v_student_id
  from public.students s
  where s.profile_id = v_uid
    and s.deleted_at is null;

  if v_student_count = 0 then
    raise exception 'learner_identity_not_found';
  end if;
  if v_student_count <> 1 then
    raise exception 'ambiguous_learner_identity';
  end if;

  with weak_outcomes as (
    select m.outcome_id,
           m.mastery_score,
           m.evidence_count,
           greatest(0,100-coalesce(m.mastery_score,0))::numeric as need_weight
    from public.student_outcome_mastery m
    join public.curriculum_learning_outcomes o on o.id = m.outcome_id
    where m.student_id = v_student_id
      and m.mastery_score is not null
      and m.mastery_score < 70
      and m.evidence_count > 0
      and o.status = 'active'
  ), candidate_paths as (
    select l.product_id,
           w.outcome_id,
           w.evidence_count,
           w.mastery_score,
           w.need_weight * l.coverage_weight *
             case l.relationship
               when 'remediates' then 1.20
               when 'practises' then 1.10
               when 'teaches' then 1.00
               when 'supports' then 0.90
               when 'prerequisite' then 0.85
               when 'assesses' then 0.60
               else 0.50
             end as path_score,
           'outcome'::text as match_type
    from weak_outcomes w
    join public.learning_product_curriculum_links l on l.outcome_id = w.outcome_id

    union all

    select l.product_id,
           w.outcome_id,
           w.evidence_count,
           w.mastery_score,
           w.need_weight * oc.relevance_weight * l.coverage_weight *
             case l.relationship
               when 'remediates' then 1.20
               when 'practises' then 1.10
               when 'teaches' then 1.00
               when 'supports' then 0.90
               when 'prerequisite' then 0.85
               when 'assesses' then 0.60
               else 0.50
             end as path_score,
           'concept'::text as match_type
    from weak_outcomes w
    join public.curriculum_outcome_concepts oc
      on oc.outcome_id = w.outcome_id
     and oc.status = 'active'
     and oc.verified_at is not null
    join public.curriculum_concepts c
      on c.id = oc.concept_id
     and c.status = 'active'
     and c.verified_at is not null
    join public.learning_product_concept_links l on l.concept_id = c.id
  ), qualified as (
    select cp.product_id,
           sum(cp.path_score) as score,
           count(distinct cp.outcome_id) as weak_outcome_count,
           sum(cp.evidence_count) as evidence_count,
           min(cp.mastery_score) as lowest_mastery,
           array_agg(distinct cp.match_type order by cp.match_type) as match_types
    from candidate_paths cp
    group by cp.product_id
  ), saleable as (
    select q.*,
           p.sku,
           p.title,
           p.product_type,
           min(o.amount_kes) as price_kes
    from qualified q
    join public.learning_products p
      on p.id = q.product_id
     and p.status = 'active'
     and p.rights_status = 'cleared'
    join public.learning_product_offers o
      on o.product_id = p.id
     and o.status = 'active'
     and o.pricing_model = 'one_time'
     and o.amount_kes is not null
     and o.amount_kes > 0
     and (o.starts_at is null or o.starts_at <= now())
     and (o.ends_at is null or o.ends_at > now())
    group by q.product_id,q.score,q.weak_outcome_count,q.evidence_count,q.lowest_mastery,q.match_types,p.sku,p.title,p.product_type
    order by q.score desc,q.evidence_count desc,p.title
    limit v_limit
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_id',s.product_id,
      'sku',s.sku,
      'title',s.title,
      'product_type',s.product_type,
      'price_kes',s.price_kes,
      'score',round(s.score,2),
      'weak_outcome_count',s.weak_outcome_count,
      'evidence_count',s.evidence_count,
      'lowest_mastery',s.lowest_mastery,
      'match_types',s.match_types,
      'reason_code','recorded_outcome_weakness'
    ) order by s.score desc,s.evidence_count desc,s.title
  ),'[]'::jsonb)
  into v_rows
  from saleable s;

  return jsonb_build_object(
    'ok',true,
    'student_id',v_student_id,
    'evidence_policy',jsonb_build_object(
      'requires_recorded_mastery',true,
      'minimum_evidence_count',1,
      'mastery_threshold',70,
      'missing_data_is_not_weakness',true,
      'learner_identity_must_be_unambiguous',true
    ),
    'recommendations',v_rows
  );
end;
$function$;

revoke all on function public.student_get_learning_product_recommendations(integer) from public,anon;
grant execute on function public.student_get_learning_product_recommendations(integer) to authenticated,service_role;

comment on function public.student_get_learning_product_recommendations(integer) is
'Deterministic evidence-to-commerce bridge. Fails closed unless auth.uid() maps to exactly one active learner row; then recommends only saleable products for recorded weak outcome evidence.';

commit;
