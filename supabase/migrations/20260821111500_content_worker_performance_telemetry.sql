begin;

create or replace function public.content_worker_performance_snapshot(
  p_worker_key text,
  p_worker_profile_version integer default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  executions bigint:=0;
  closed_executions bigint:=0;
  candidates bigint:=0;
  blocked bigint:=0;
  reviewed bigint:=0;
  reviews_with_findings bigint:=0;
  repairs_attempted bigint:=0;
  repairs_succeeded bigint:=0;
  curriculum_blocks bigint:=0;
  assessment_blocks bigint:=0;
  science_blocks bigint:=0;
  eval_total bigint:=0;
  eval_passed bigint:=0;
  incorrect_passes bigint:=0;
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'service_role_required';
  end if;

  select
    count(*),
    count(*) filter(where status in ('quality_candidate','blocked','preflight_failed','self_review_failed')),
    count(*) filter(where status='quality_candidate'),
    count(*) filter(where status in ('blocked','preflight_failed','self_review_failed')),
    count(*) filter(where self_review is not null),
    count(*) filter(where self_review is not null and jsonb_array_length(coalesce(self_review->'findings','[]'::jsonb))>0),
    count(*) filter(where coalesce((self_review->>'repair_applied')::boolean,false)),
    count(*) filter(where coalesce((self_review->>'repair_applied')::boolean,false) and status='quality_candidate'),
    count(*) filter(where exists(select 1 from jsonb_array_elements_text(coalesce(blockers,'[]'::jsonb)) b where lower(b) like '%curriculum%' or lower(b) like '%outcome%')),
    count(*) filter(where exists(select 1 from jsonb_array_elements_text(coalesce(blockers,'[]'::jsonb)) b where lower(b) like '%assessment%' or lower(b) like '%marking%')),
    count(*) filter(where exists(select 1 from jsonb_array_elements_text(coalesce(blockers,'[]'::jsonb)) b where lower(b) like '%scientific%' or lower(b) like '%chemistry%'))
  into executions,closed_executions,candidates,blocked,reviewed,reviews_with_findings,repairs_attempted,repairs_succeeded,curriculum_blocks,assessment_blocks,science_blocks
  from public.content_worker_execution_contexts
  where worker_key=p_worker_key
    and (p_worker_profile_version is null or worker_profile_version=p_worker_profile_version);

  select
    count(*),
    count(*) filter(where passed),
    count(*) filter(where actual_disposition='incorrect_pass')
  into eval_total,eval_passed,incorrect_passes
  from public.content_worker_evaluations
  where worker_key=p_worker_key
    and (p_worker_profile_version is null or worker_profile_version=p_worker_profile_version);

  return jsonb_build_object(
    'worker_key',p_worker_key,
    'worker_profile_version',p_worker_profile_version,
    'primary_metric','trustworthy_classroom_ready_candidate_production',
    'execution_count',executions,
    'closed_execution_count',closed_executions,
    'quality_candidate_count',candidates,
    'blocked_count',blocked,
    'first_pass_quality_candidate_rate',case when closed_executions=0 then null else round(candidates::numeric/closed_executions,4) end,
    'self_reviewed_count',reviewed,
    'self_review_defect_discovery_rate',case when reviewed=0 then null else round(reviews_with_findings::numeric/reviewed,4) end,
    'self_repair_attempt_count',repairs_attempted,
    'self_repair_success_rate',case when repairs_attempted=0 then null else round(repairs_succeeded::numeric/repairs_attempted,4) end,
    'unresolved_blocker_rate',case when closed_executions=0 then null else round(blocked::numeric/closed_executions,4) end,
    'curriculum_omission_or_outcome_block_rate',case when closed_executions=0 then null else round(curriculum_blocks::numeric/closed_executions,4) end,
    'assessment_or_marking_block_rate',case when closed_executions=0 then null else round(assessment_blocks::numeric/closed_executions,4) end,
    'scientific_uncertainty_or_correctness_block_rate',case when closed_executions=0 then null else round(science_blocks::numeric/closed_executions,4) end,
    'evaluation_case_count',eval_total,
    'evaluation_pass_count',eval_passed,
    'evaluation_incorrect_pass_count',incorrect_passes
  );
end $$;
revoke all on function public.content_worker_performance_snapshot(text,integer) from public,anon,authenticated;
grant execute on function public.content_worker_performance_snapshot(text,integer) to service_role;

commit;
