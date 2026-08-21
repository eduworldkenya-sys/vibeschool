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
  subject_profile jsonb;
  quality_contract jsonb;
  evaluation_suite jsonb;
  plan jsonb;
  effective_claim jsonb;
  execution_id uuid;
  blockers jsonb;
  resolved_subject text;
  resolved_grade text;
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'service_role_required';
  end if;
  if p_claim is null or jsonb_typeof(p_claim)<>'object' then
    raise exception 'content_worker_claim_required';
  end if;

  select vp.cbc_subject, vp.cbc_grade::text
    into resolved_subject,resolved_grade
  from public.vibe_chapters vc
  join public.vibe_publications vp on vp.id=vc.publication_id
  where vc.id=nullif(p_claim->'target'->>'chapter_id','')::uuid
  limit 1;

  resolved_subject:=coalesce(nullif(p_claim->>'subject',''),resolved_subject,'');
  resolved_grade:=coalesce(nullif(p_claim->>'grade',''),resolved_grade,'');
  effective_claim:=p_claim||jsonb_build_object('subject',resolved_subject,'grade',resolved_grade);

  professional:=public.content_worker_active_profile('senior-educational-content-developer');
  quality_contract:=public.content_worker_active_profile('teacher-guide-quality-contract');
  evaluation_suite:=public.content_worker_active_profile('chemistry-content-worker-evaluation');
  if lower(resolved_subject)='chemistry' and resolved_grade ~ '10' then
    subject_profile:=public.content_worker_active_profile('chemistry-grade10-author');
  end if;
  if professional is null or quality_contract is null or evaluation_suite is null then
    raise exception 'content_worker_professional_context_incomplete';
  end if;
  if lower(resolved_subject)='chemistry' and resolved_grade ~ '10' and subject_profile is null then
    raise exception 'content_worker_chemistry_subject_context_incomplete';
  end if;

  plan:=public.content_worker_build_plan(effective_claim);
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
    nullif(effective_claim->>'task_id','')::uuid,
    nullif(effective_claim->>'proposal_id','')::uuid,
    coalesce(nullif(effective_claim->>'worker_key',''),'content-authoring-worker'),
    professional->>'profile_key',(professional->>'version')::int,
    subject_profile->>'profile_key',nullif(subject_profile->>'version','')::int,
    quality_contract->>'profile_key',(quality_contract->>'version')::int,
    (evaluation_suite->>'version')::int,
    jsonb_build_object(
      'title',effective_claim->>'title',
      'claim',effective_claim->>'claim',
      'curriculum_relevance',effective_claim->>'curriculum_relevance',
      'subject',resolved_subject,
      'grade',resolved_grade,
      'target',effective_claim->'target',
      'claim_sha256',effective_claim->>'claim_sha256',
      'current_content_sha256',effective_claim->'target'->>'current_content_sha256'
    ),
    effective_claim->>'evidence_packet_sha256',plan,'planned',blockers
  ) returning id into execution_id;

  return jsonb_build_object(
    'execution_context_id',execution_id,
    'professional_profile',professional,
    'subject_profile',subject_profile,
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

create or replace function public.content_worker_complete_professional_authoring(
  p_execution_context_id uuid,
  p_task_id uuid,
  p_proposal_id uuid,
  p_model_invocation_id uuid,
  p_draft_content text,
  p_rationale text,
  p_citations jsonb,
  p_structured_output jsonb,
  p_self_review jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  ctx public.content_worker_execution_contexts%rowtype;
  completion jsonb;
  finished jsonb;
begin
  if current_user not in ('service_role','postgres') then
    raise exception 'service_role_required';
  end if;

  select * into ctx
  from public.content_worker_execution_contexts
  where id=p_execution_context_id
  for update;
  if not found then raise exception 'content_worker_execution_context_not_found'; end if;
  if ctx.status<>'planned' then raise exception 'content_worker_execution_not_planned'; end if;
  if ctx.task_id is distinct from p_task_id or ctx.proposal_id is distinct from p_proposal_id then
    raise exception 'content_worker_execution_identity_mismatch';
  end if;
  if coalesce((p_self_review->>'blocking_uncertainty')::boolean,true) then
    raise exception 'content_worker_self_review_blocking_uncertainty';
  end if;
  if exists(
    select 1 from jsonb_array_elements(coalesce(p_self_review->'findings','[]'::jsonb)) f
    where f->>'severity' in ('major','critical')
  ) then
    raise exception 'content_worker_self_review_unresolved_blocking_finding';
  end if;

  completion:=public.hq_content_authoring_complete(
    p_task_id,p_proposal_id,p_model_invocation_id,
    p_draft_content,p_rationale,p_citations,p_structured_output
  );
  finished:=public.content_worker_finish_execution(
    p_execution_context_id,'quality_candidate',p_self_review,'[]'::jsonb
  );

  return jsonb_build_object(
    'authoring',completion,
    'execution_context',finished,
    'publication_authority',false
  );
end $$;
revoke all on function public.content_worker_complete_professional_authoring(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.content_worker_complete_professional_authoring(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) to service_role;

commit;
