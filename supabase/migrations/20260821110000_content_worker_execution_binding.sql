begin;

-- Bind Priority 1 professional context and inspectable planning to the existing R2 authoring executor.
-- access: service-only public.content_worker_execution_contexts
-- authorization-test: public.content_worker_execution_contexts

create or replace function public.content_worker_begin_execution(p_claim jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  professional jsonb;
  chemistry jsonb;
  quality_contract jsonb;
  evaluation_suite jsonb;
  plan jsonb;
  execution_id uuid;
  blockers jsonb;
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'service_role_required';
  end if;
  if p_claim is null or jsonb_typeof(p_claim)<>'object' then
    raise exception 'content_worker_claim_required';
  end if;

  professional:=public.content_worker_active_profile('senior-educational-content-developer');
  chemistry:=public.content_worker_active_profile('chemistry-grade10-author');
  quality_contract:=public.content_worker_active_profile('teacher-guide-quality-contract');
  evaluation_suite:=public.content_worker_active_profile('chemistry-content-worker-evaluation');
  if professional is null or quality_contract is null or evaluation_suite is null then
    raise exception 'content_worker_professional_context_incomplete';
  end if;

  plan:=public.content_worker_build_plan(p_claim);
  blockers:=coalesce(plan->'blockers','[]'::jsonb);
  if jsonb_array_length(blockers)>0 then
    raise exception 'content_worker_plan_blocked:%', blockers::text;
  end if;

  insert into public.content_worker_execution_contexts(
    task_id,proposal_id,worker_key,
    worker_profile_key,worker_profile_version,
    subject_profile_key,subject_profile_version,
    quality_contract_key,quality_contract_version,
    evaluation_suite_version,
    mission_context,evidence_packet_sha256,plan,status,blockers
  ) values (
    nullif(p_claim->>'task_id','')::uuid,
    nullif(p_claim->>'proposal_id','')::uuid,
    coalesce(nullif(p_claim->>'worker_key',''),'content-authoring-worker'),
    professional->>'profile_key',(professional->>'version')::int,
    chemistry->>'profile_key',(chemistry->>'version')::int,
    quality_contract->>'profile_key',(quality_contract->>'version')::int,
    (evaluation_suite->>'version')::int,
    jsonb_build_object(
      'title',p_claim->>'title',
      'claim',p_claim->>'claim',
      'curriculum_relevance',p_claim->>'curriculum_relevance',
      'target',p_claim->'target',
      'claim_sha256',p_claim->>'claim_sha256',
      'current_content_sha256',p_claim->'target'->>'current_content_sha256'
    ),
    p_claim->>'evidence_packet_sha256',plan,'planned',blockers
  ) returning id into execution_id;

  return jsonb_build_object(
    'execution_context_id',execution_id,
    'professional_profile',professional,
    'subject_profile',chemistry,
    'quality_contract',quality_contract,
    'evaluation_suite_version',evaluation_suite->>'version',
    'plan',plan
  );
end $$;
revoke all on function public.content_worker_begin_execution(jsonb) from public,anon,authenticated;
grant execute on function public.content_worker_begin_execution(jsonb) to service_role;

create or replace function public.content_worker_finish_execution(
  p_execution_context_id uuid,
  p_status text,
  p_self_review jsonb default null,
  p_blockers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  row_out public.content_worker_execution_contexts%rowtype;
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'service_role_required';
  end if;
  if p_status not in ('generated','preflight_failed','self_review_failed','blocked','quality_candidate') then
    raise exception 'invalid_content_worker_execution_status';
  end if;
  if p_status='quality_candidate' and jsonb_array_length(coalesce(p_blockers,'[]'::jsonb))>0 then
    raise exception 'quality_candidate_cannot_have_blockers';
  end if;

  update public.content_worker_execution_contexts
  set status=p_status,
      self_review=p_self_review,
      blockers=coalesce(p_blockers,'[]'::jsonb),
      completed_at=case when p_status in ('blocked','quality_candidate','preflight_failed','self_review_failed') then now() else completed_at end
  where id=p_execution_context_id
  returning * into row_out;
  if not found then raise exception 'content_worker_execution_context_not_found'; end if;
  return to_jsonb(row_out);
end $$;
revoke all on function public.content_worker_finish_execution(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.content_worker_finish_execution(uuid,text,jsonb,jsonb) to service_role;

commit;
