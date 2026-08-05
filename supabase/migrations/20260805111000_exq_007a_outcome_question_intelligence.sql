begin;

create or replace function public.exq_get_assignment_intelligence(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid:=auth.uid();
  aa public.assessment_assignments%rowtype;
  question_payload jsonb;
  difficulty_payload jsonb;
  bloom_payload jsonb;
  outcome_payload jsonb;
  misconception_payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into aa from public.assessment_assignments where id=p_assignment_id;
  if not found then raise exception 'assignment_not_found'; end if;
  if aa.teacher_id is distinct from caller then raise exception 'assignment_not_owned'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ai.id,'order_num',ai.order_num,'prompt',ai.prompt,
    'question_type',ai.question_type,'difficulty',coalesce(ai.difficulty,'unclassified'),
    'bloom_level',coalesce(ai.bloom_level,'unclassified'),
    'response_count',coalesce(stats.response_count,0),'average_percentage',stats.average_percentage,
    'zero_score_count',coalesce(stats.zero_score_count,0),'full_score_count',coalesce(stats.full_score_count,0),
    'performance_band',case when stats.average_percentage is null then 'not_assessed'
      when stats.average_percentage>=80 then 'strong' when stats.average_percentage>=60 then 'secure'
      when stats.average_percentage>=40 then 'developing' else 'critical_gap' end
  ) order by ai.order_num),'[]'::jsonb)
  into question_payload
  from public.assessment_items ai
  left join lateral (
    select count(ar.id) response_count,
      round(avg(case when ar.max_score>0 then (ar.final_score/ar.max_score)*100 end),2) average_percentage,
      count(*) filter(where ar.final_score=0) zero_score_count,
      count(*) filter(where ar.final_score=ar.max_score) full_score_count
    from public.assessment_attempts at
    join public.assessment_responses ar on ar.attempt_id=at.id
    where at.assignment_id=aa.id and at.status='released' and at.result_status='released'
      and ar.assessment_item_id=ai.id and ar.final_score is not null
  ) stats on true
  where ai.assessment_id=aa.assessment_id and ai.status='approved';

  select coalesce(jsonb_agg(jsonb_build_object(
    'difficulty',difficulty,'response_count',response_count,
    'average_percentage',average_percentage,'learners_below_50',learners_below_50
  ) order by difficulty),'[]'::jsonb)
  into difficulty_payload
  from (
    select coalesce(ai.difficulty,'unclassified') difficulty,
      count(ar.id) response_count,
      round(avg(case when ar.max_score>0 then (ar.final_score/ar.max_score)*100 end),2) average_percentage,
      count(distinct at.student_id) filter(where ar.max_score>0 and (ar.final_score/ar.max_score)*100<50) learners_below_50
    from public.assessment_items ai
    left join public.assessment_attempts at on at.assignment_id=aa.id and at.status='released' and at.result_status='released'
    left join public.assessment_responses ar on ar.attempt_id=at.id and ar.assessment_item_id=ai.id and ar.final_score is not null
    where ai.assessment_id=aa.assessment_id and ai.status='approved'
    group by coalesce(ai.difficulty,'unclassified')
  ) d;

  select coalesce(jsonb_agg(jsonb_build_object(
    'bloom_level',bloom_level,'response_count',response_count,
    'average_percentage',average_percentage,'learners_below_50',learners_below_50
  ) order by bloom_level),'[]'::jsonb)
  into bloom_payload
  from (
    select coalesce(ai.bloom_level,'unclassified') bloom_level,
      count(ar.id) response_count,
      round(avg(case when ar.max_score>0 then (ar.final_score/ar.max_score)*100 end),2) average_percentage,
      count(distinct at.student_id) filter(where ar.max_score>0 and (ar.final_score/ar.max_score)*100<50) learners_below_50
    from public.assessment_items ai
    left join public.assessment_attempts at on at.assignment_id=aa.id and at.status='released' and at.result_status='released'
    left join public.assessment_responses ar on ar.attempt_id=at.id and ar.assessment_item_id=ai.id and ar.final_score is not null
    where ai.assessment_id=aa.assessment_id and ai.status='approved'
    group by coalesce(ai.bloom_level,'unclassified')
  ) b;

  select coalesce(jsonb_agg(jsonb_build_object(
    'outcome_id',clo.id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
    'response_count',stats.response_count,'average_percentage',stats.average_percentage,
    'learners_below_50',stats.learners_below_50,
    'mastery_band',case when stats.average_percentage is null then 'not_assessed'
      when stats.average_percentage>=80 then 'mastered' when stats.average_percentage>=60 then 'proficient'
      when stats.average_percentage>=40 then 'developing' else 'beginning' end
  ) order by clo.outcome_code nulls last,clo.outcome_text),'[]'::jsonb)
  into outcome_payload
  from public.curriculum_learning_outcomes clo
  join (select distinct aio.outcome_id from public.assessment_items ai join public.assessment_item_outcomes aio on aio.assessment_item_id=ai.id where ai.assessment_id=aa.assessment_id) linked on linked.outcome_id=clo.id
  left join lateral (
    select count(ar.id) response_count,
      round(avg(case when ar.max_score>0 then (ar.final_score/ar.max_score)*100 end),2) average_percentage,
      count(distinct at.student_id) filter(where ar.max_score>0 and (ar.final_score/ar.max_score)*100<50) learners_below_50
    from public.assessment_attempts at
    join public.assessment_responses ar on ar.attempt_id=at.id
    join public.assessment_item_outcomes aio on aio.assessment_item_id=ar.assessment_item_id and aio.outcome_id=clo.id
    where at.assignment_id=aa.id and at.status='released' and at.result_status='released' and ar.final_score is not null
  ) stats on true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assessment_item_id',ai.id,'order_num',ai.order_num,'prompt',ai.prompt,
    'average_percentage',stats.average_percentage,'zero_score_count',stats.zero_score_count,
    'affected_learners',stats.affected_learners,
    'signal',case when stats.average_percentage<30 then 'widespread_misconception'
      when stats.average_percentage<50 then 'common_gap' else 'monitor' end,
    'recommended_action',case when stats.average_percentage<30 then 'reteach_with_different_representation'
      when stats.average_percentage<50 then 'guided_correction_and_targeted_practice'
      else 'review_examples_and_monitor' end
  ) order by stats.average_percentage,ai.order_num),'[]'::jsonb)
  into misconception_payload
  from public.assessment_items ai
  join lateral (
    select round(avg(case when ar.max_score>0 then (ar.final_score/ar.max_score)*100 end),2) average_percentage,
      count(*) filter(where ar.final_score=0) zero_score_count,
      count(distinct at.student_id) filter(where ar.max_score>0 and (ar.final_score/ar.max_score)*100<50) affected_learners
    from public.assessment_attempts at
    join public.assessment_responses ar on ar.attempt_id=at.id
    where at.assignment_id=aa.id and at.status='released' and at.result_status='released'
      and ar.assessment_item_id=ai.id and ar.final_score is not null
  ) stats on stats.average_percentage<60
  where ai.assessment_id=aa.assessment_id and ai.status='approved';

  return jsonb_build_object('ok',true,'assignment_id',aa.id,'questions',question_payload,
    'difficulty',difficulty_payload,'bloom',bloom_payload,'outcomes',outcome_payload,
    'misconceptions',misconception_payload);
end;
$$;

revoke all on function public.exq_get_assignment_intelligence(uuid) from public,anon;
grant execute on function public.exq_get_assignment_intelligence(uuid) to authenticated,service_role;

commit;
