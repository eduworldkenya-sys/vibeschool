-- access: service-only public.hq_content_factory_r2_canary_sessions
-- authorization-test: public.hq_content_factory_r2_canary_sessions
create table if not exists public.hq_content_factory_r2_canary_sessions (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null check (worker_key='content-factory-r2-canary-01'),
  token_sha256 text not null check (token_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('prepared','research_dispatched','semantic_bound','semantic_dispatched','authoring_bound','authoring_dispatched','completed','failed')),
  proposal_id uuid references public.curriculum_intelligence_proposals(id) on delete restrict,
  research_job_id uuid references public.curriculum_research_jobs(id) on delete restrict,
  objective_id uuid references public.hq_workforce_objectives(id) on delete restrict,
  plan_id uuid references public.hq_workforce_plans(id) on delete restrict,
  research_step_id uuid references public.hq_workforce_plan_steps(id) on delete restrict,
  semantic_step_id uuid references public.hq_workforce_plan_steps(id) on delete restrict,
  authoring_step_id uuid references public.hq_workforce_plan_steps(id) on delete restrict,
  research_task_id uuid references public.hq_workforce_task_contracts(id) on delete restrict,
  semantic_task_id uuid references public.hq_workforce_task_contracts(id) on delete restrict,
  authoring_task_id uuid references public.hq_workforce_task_contracts(id) on delete restrict,
  source_id uuid references public.curriculum_intelligence_sources(id) on delete restrict,
  draft_id uuid references public.curriculum_authoring_drafts(id) on delete restrict,
  target_block_id uuid references public.content_blocks(id) on delete restrict,
  target_block_sha256 text not null,
  expires_at timestamptz not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);
alter table public.hq_content_factory_r2_canary_sessions enable row level security;
revoke all on table public.hq_content_factory_r2_canary_sessions from public,anon,authenticated,service_role;
grant select on table public.hq_content_factory_r2_canary_sessions to service_role;

create or replace function public.hq_content_factory_r2_operator_prepare_canary()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_worker constant text := 'content-factory-r2-canary-01';
  v_token text;
  v_session uuid;
  v_creation uuid;
  v_proposal uuid;
  v_job uuid;
  v_obj uuid;
  v_plan uuid;
  v_research_step uuid;
  v_semantic_step uuid;
  v_authoring_step uuid;
  v_research_task uuid;
  v_block uuid := 'd4e4038b-8f65-43f5-8797-08aa4971f739'::uuid;
  v_block_text text;
  v_block_sha text;
  v_plan_hash text;
  r record;
begin
  if session_user <> 'postgres' then raise exception 'gate2_operator_postgres_required'; end if;
  if exists(select 1 from public.hq_content_factory_r2_canary_sessions where status not in ('completed','failed') and expires_at>clock_timestamp()) then
    raise exception 'gate2_canary_session_already_active';
  end if;
  if exists(select 1 from public.hq_workforce_capability_authority_grants where status='active' and expires_at>clock_timestamp()) then raise exception 'gate2_active_r14_authority_preexists'; end if;
  if exists(select 1 from public.hq_workforce_capability_grants where status='active' and expires_at>clock_timestamp()) then raise exception 'gate2_active_legacy_authority_preexists'; end if;
  if not exists(select 1 from public.hq_workforce_certifications where worker_key=v_worker and status='active' and expires_at>clock_timestamp()) then raise exception 'gate2_canary_certification_required'; end if;
  if public.hq_workforce_current_lifecycle_state(v_worker) <> 'certified' then raise exception 'gate2_canary_must_start_certified'; end if;
  if exists(select 1 from public.hq_workforce_engine_contract where singleton and (runtime_execution_enabled or runtime_autonomy_level<>0 or runtime_max_risk<>0 or heartbeat_enabled or factory_enabled or not shadow_global_stop)) then raise exception 'gate2_engine_not_fail_closed'; end if;

  select id into v_creation from public.hq_workforce_creation_contracts
   where worker_key=v_worker and status in ('issued','consumed') and (expires_at is null or expires_at>clock_timestamp())
   order by issued_at desc limit 1;
  if v_creation is null then raise exception 'gate2_creation_contract_required'; end if;

  select plain_text into v_block_text from public.content_blocks where id=v_block and chapter_id='139eb920-70e6-4d10-a037-eba5043b9062'::uuid and sequence=7;
  if not found or coalesce(btrim(v_block_text),'')='' then raise exception 'gate2_target_block_missing'; end if;
  v_block_sha:=encode(extensions.digest(convert_to(v_block_text,'UTF8'),'sha256'),'hex');
  v_token:=encode(gen_random_bytes(32),'hex');

  insert into public.curriculum_intelligence_proposals(
    publication_id,chapter_id,proposal_type,title,claim,current_content,proposed_content,patch,rationale,curriculum_relevance,
    confidence,verification_status,volatility,status,generated_by,editorial_status
  ) values (
    '486596f4-a604-45ab-bb5f-1c702e07f793'::uuid,
    '139eb920-70e6-4d10-a037-eba5043b9062'::uuid,
    'enrichment','Gate 2 canary — chromosomes, DNA, genes and alleles',
    'Chromosomes contain DNA, and genes are sections of DNA that carry hereditary information.',
    v_block_text,'Human editorial review required before any target-content change.',
    jsonb_build_object('sequence',7,'gate2_canary',true),
    'Production canary proving research → semantic verification → source-grounded authoring without publication.',
    'C3',0,'unverified','low','pending_review',v_worker,'not_prepared'
  ) returning id into v_proposal;

  insert into public.curriculum_research_jobs(proposal_id,status,priority,research_question,required_source_count,require_primary_source,allowed_domains,max_attempts)
  values(v_proposal,'queued',100,'Find authoritative evidence that chromosomes contain DNA and genes are sections of DNA carrying hereditary information.',1,false,null,1)
  returning id into v_job;

  insert into public.hq_workforce_objectives(objective_key,source_type,source_ref,desired_outcome,scope_type,scope_ref,constraints,success_criteria,evidence_requirements,priority,risk_class,status,provenance)
  values('content-factory-gate2-'||v_proposal::text,'commissioning',v_proposal::text,'Produce one source-grounded human-review-only curriculum draft through the certified R2 chain','platform_internal','{}'::jsonb,
    '["no publication","one canary worker","three certified capabilities","automatic authority revocation"]'::jsonb,
    '["research task completes","semantic material-bound verdict completes","authoring draft exists","target block unchanged"]'::jsonb,
    '["immutable task evidence","semantic material hash","draft evidence packet hash"]'::jsonb,100,1,'approved',
    jsonb_build_object('programme','content_factory_r2_gate2','operator','system:postgres','bounded_canary',true)) returning id into v_obj;

  insert into public.hq_workforce_plans(objective_id,plan_key,version,strategy_key,status,required_autonomy,required_risk,estimated_cost,reversibility_score,evidence_quality,rationale,verification_contract,compensation_contract,provenance)
  values(v_obj,'content-factory-r2-three-stage',1,'certified-r2-chain','selected',1,1,3,1,1,
    '{"reason":"exact certified R2 research-semantic-authoring chain"}'::jsonb,
    '{"requires":["immutable evidence","human acceptance boundary","fail-closed rollback"]}'::jsonb,
    '{"strategy":"revoke temporary authority; discard unaccepted draft; never mutate target content"}'::jsonb,
    jsonb_build_object('programme','content_factory_r2_gate2','operator','system:postgres')) returning id into v_plan;

  insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode,worker_key,input_contract,expected_output,verification_contract,required_autonomy,required_risk,status)
  values(v_plan,'research',1,'Discover candidate evidence','worker',v_worker,jsonb_build_object('research_job_id',v_job),'{}','{"semantic_classification_required":true}',1,1,'simulated') returning id into v_research_step;
  insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode,worker_key,input_contract,expected_output,verification_contract,required_autonomy,required_risk,status)
  values(v_plan,'semantic',2,'Verify exact source material against claim','worker',v_worker,'{}','{}','{"material_binding_required":true}',1,1,'simulated') returning id into v_semantic_step;
  insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,purpose,actor_mode,worker_key,input_contract,expected_output,verification_contract,required_autonomy,required_risk,status)
  values(v_plan,'authoring',3,'Draft only from verified evidence','worker',v_worker,jsonb_build_object('proposal_id',v_proposal),'{}','{"human_acceptance_required":true}',1,1,'simulated') returning id into v_authoring_step;

  insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id,role)
  select v_research_step,id,'required' from public.hq_workforce_capabilities where capability_key='content.research.execute' and version=1;
  insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id,role)
  select v_semantic_step,id,'required' from public.hq_workforce_capabilities where capability_key='content.evidence.semantic_verify' and version=1;
  insert into public.hq_workforce_plan_step_capabilities(plan_step_id,capability_id,role)
  select v_authoring_step,id,'required' from public.hq_workforce_capabilities where capability_key='content.authoring.source_grounded' and version=1;

  insert into public.hq_workforce_plan_dependencies(plan_id,step_id,depends_on_step_id) values(v_plan,v_semantic_step,v_research_step),(v_plan,v_authoring_step,v_semantic_step);
  v_plan_hash:=public.hq_workforce_plan_authority_hash(v_plan);
  update public.hq_workforce_objectives set approved_plan_id=v_plan,approved_plan_hash=v_plan_hash,approved_at=clock_timestamp(),approval_evidence='[{"actor":"system:postgres","reason":"bounded Gate 2 commissioning operator; no owner impersonation"}]'::jsonb where id=v_obj;

  update public.hq_workforce_workers set paid_ai_allowed=true where worker_key=v_worker;
  perform public.hq_workforce_transition_worker(v_worker,'active','Gate 2 bounded production canary activation via infrastructure operator',v_creation);

  insert into public.hq_workforce_identities(worker_key,identity_key,credential_ref,status,expires_at)
  values(v_worker,'content-factory-r2-gate2-'||v_proposal::text,'ephemeral:gate2:production-canary','active',clock_timestamp()+interval '25 minutes');

  insert into public.hq_workforce_execution_budgets(worker_key,budget_key,unit,limit_amount,period_start,period_end,status)
  values(v_worker,'gate2_operations','operation',6,clock_timestamp(),clock_timestamp()+interval '25 minutes','active'),
        (v_worker,'model_tokens','token',8000,clock_timestamp(),clock_timestamp()+interval '25 minutes','active');

  for r in
    select c.capability_key,c.version,s.id skill_id,t.id tool_id,t.operation,t.resource_type,s.compensation_strategy
    from public.hq_workforce_capabilities c
    join public.hq_workforce_skill_capabilities sc on sc.capability_id=c.id and sc.role='implements'
    join public.hq_workforce_skill_manifests s on s.id=sc.skill_manifest_id and s.certification_status='certified'
    join public.hq_workforce_tool_contracts t on t.id=s.tool_contract_id and t.status='approved'
    where c.capability_key in ('content.research.execute','content.evidence.semantic_verify','content.authoring.source_grounded') and c.version=1
  loop
    insert into public.hq_workforce_capability_grants(worker_key,capability_key,operation,resource_type,scope_type,scope_ref,granted_by_contract_id,status,expires_at)
    values(v_worker,r.capability_key,r.operation,r.resource_type,'platform_internal','{}'::jsonb,v_creation,'active',clock_timestamp()+interval '25 minutes');
    insert into public.hq_workforce_capability_authority_grants(
      grant_key,capability_key,capability_version,skill_manifest_id,tool_contract_id,permitted_worker_key,operation,resource_type,scope_type,scope_ref,
      autonomy_level,risk_class,max_operations_per_cycle,max_records_per_operation,max_concurrency,max_executions_per_minute,idempotency_required,verification_required,compensation_required,
      compensation_strategy,precondition_contract,verification_contract,governance_evidence,status,certified_at,activated_at,expires_at,lifecycle_reason,lifecycle_evidence
    ) values(
      'gate2-'||replace(r.capability_key,'.','-')||'-'||v_proposal::text,r.capability_key,r.version,r.skill_id,r.tool_id,v_worker,r.operation,r.resource_type,'platform_internal','{}'::jsonb,
      1,1,3,1,1,6,true,true,true,r.compensation_strategy,'[]'::jsonb,'{"gate2":true}'::jsonb,
      jsonb_build_object('programme','content_factory_r2_gate2','operator','system:postgres','worker',v_worker,'proposal_id',v_proposal),
      'active',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '25 minutes','Bounded Gate 2 production canary','["certified shadow worker","one-shot operator lane","automatic revocation required"]'::jsonb
    );
  end loop;

  insert into public.hq_workforce_runtime_policies(policy_key,scope_kind,scope_key,enabled,max_autonomy_level,max_risk_class,max_concurrency,max_executions_per_minute,reason,status)
  values('content-factory-r2-gate2-global','global','global',true,1,1,1,6,'One-shot Content Factory R2 Gate 2 production canary','active')
  on conflict(policy_key) do update set enabled=true,max_autonomy_level=1,max_risk_class=1,max_concurrency=1,max_executions_per_minute=6,reason=excluded.reason,status='active',updated_at=clock_timestamp();
  insert into public.hq_workforce_runtime_policies(policy_key,scope_kind,scope_key,enabled,max_autonomy_level,max_risk_class,max_concurrency,max_executions_per_minute,reason,status)
  values('content-factory-r2-gate2-worker','worker',v_worker,true,1,1,1,6,'Restrict Gate 2 runtime to certified canary worker','active')
  on conflict(policy_key) do update set enabled=true,max_autonomy_level=1,max_risk_class=1,max_concurrency=1,max_executions_per_minute=6,reason=excluded.reason,status='active',updated_at=clock_timestamp();

  update public.hq_workforce_engine_contract set runtime_execution_enabled=true,runtime_autonomy_level=1,runtime_max_risk=1,runtime_max_concurrency=1,runtime_max_executions_per_minute=6,
    runtime_anomaly_paused=false,heartbeat_enabled=false,factory_enabled=false,shadow_global_stop=true,updated_at=clock_timestamp() where singleton=true;

  insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,capability_version,operation,resource_type,scope_type,scope_ref,payload,idempotency_key,budget_key,budget_amount,status,max_attempts,plan_step_id)
  select 'gate2-research-'||v_proposal::text,v_worker,t.id,'content.research.execute',1,'research','curriculum_research_job','platform_internal','{}'::jsonb,
         jsonb_build_object('research_job_id',v_job),'gate2-research-'||v_proposal::text,'gate2_operations',1,'queued',1,v_research_step
  from public.hq_workforce_tool_contracts t where t.tool_key='content.research.external' and t.version=1 and t.status='approved'
  returning id into v_research_task;

  update public.curriculum_research_jobs set workforce_task_id=v_research_task where id=v_job;
  insert into public.hq_content_factory_r2_canary_sessions(worker_key,token_sha256,status,proposal_id,research_job_id,objective_id,plan_id,research_step_id,semantic_step_id,authoring_step_id,research_task_id,target_block_id,target_block_sha256,expires_at,evidence)
  values(v_worker,encode(extensions.digest(convert_to(v_token,'UTF8'),'sha256'),'hex'),'prepared',v_proposal,v_job,v_obj,v_plan,v_research_step,v_semantic_step,v_authoring_step,v_research_task,v_block,v_block_sha,clock_timestamp()+interval '25 minutes',
    jsonb_build_object('operator','system:postgres','owner_impersonation',false,'runtime_ceiling','L1/R1','publication_authority',false)) returning id into v_session;

  return jsonb_build_object('session_id',v_session,'invocation_token',v_token,'proposal_id',v_proposal,'research_job_id',v_job,'research_task_id',v_research_task,'expires_at',clock_timestamp()+interval '25 minutes');
end $$;

create or replace function public.hq_content_factory_r2_operator_bind_semantic(p_session_id uuid,p_source_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hq_content_factory_r2_canary_sessions%rowtype; v_task uuid; begin
 if session_user<>'postgres' then raise exception 'gate2_operator_postgres_required'; end if;
 select * into s from public.hq_content_factory_r2_canary_sessions where id=p_session_id for update;
 if not found or s.status<>'research_dispatched' or s.expires_at<=clock_timestamp() then raise exception 'gate2_semantic_bind_session_denied'; end if;
 if not exists(select 1 from public.hq_workforce_task_contracts where id=s.research_task_id and status='completed') then raise exception 'gate2_research_task_not_completed'; end if;
 if not exists(select 1 from public.curriculum_intelligence_sources where id=p_source_id and proposal_id=s.proposal_id) then raise exception 'gate2_source_not_in_proposal'; end if;
 insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,capability_version,operation,resource_type,scope_type,scope_ref,payload,idempotency_key,budget_key,budget_amount,status,max_attempts,plan_step_id)
 select 'gate2-semantic-'||s.proposal_id::text,s.worker_key,t.id,'content.evidence.semantic_verify',1,'verify_semantics','curriculum_intelligence_source','platform_internal','{}'::jsonb,
        jsonb_build_object('source_id',p_source_id,'token_budget',2500),'gate2-semantic-'||s.proposal_id::text,'gate2_operations',1,'queued',1,s.semantic_step_id
 from public.hq_workforce_tool_contracts t where t.tool_key='content.evidence.semantic_verify' and t.version=1 and t.status='approved'
 returning id into v_task;
 update public.hq_content_factory_r2_canary_sessions set semantic_task_id=v_task,source_id=p_source_id,status='semantic_bound',evidence=evidence||jsonb_build_object('source_id',p_source_id) where id=s.id;
 return jsonb_build_object('session_id',s.id,'semantic_task_id',v_task,'source_id',p_source_id);
end $$;

create or replace function public.hq_content_factory_r2_operator_bind_authoring(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hq_content_factory_r2_canary_sessions%rowtype; v_task uuid; v_rec jsonb; begin
 if session_user<>'postgres' then raise exception 'gate2_operator_postgres_required'; end if;
 select * into s from public.hq_content_factory_r2_canary_sessions where id=p_session_id for update;
 if not found or s.status<>'semantic_dispatched' or s.expires_at<=clock_timestamp() then raise exception 'gate2_authoring_bind_session_denied'; end if;
 if not exists(select 1 from public.hq_workforce_task_contracts where id=s.semantic_task_id and status='completed') then raise exception 'gate2_semantic_task_not_completed'; end if;
 v_rec:=public.hq_content_research_reconcile_after_semantic(s.research_job_id);
 if v_rec->>'status'<>'evidence_ready' then raise exception 'gate2_semantic_reconciliation_not_ready:%',v_rec; end if;
 insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,capability_version,operation,resource_type,scope_type,scope_ref,payload,idempotency_key,budget_key,budget_amount,status,max_attempts,plan_step_id)
 select 'gate2-authoring-'||s.proposal_id::text,s.worker_key,t.id,'content.authoring.source_grounded',1,'draft_content','curriculum_intelligence_proposal','platform_internal','{}'::jsonb,
        jsonb_build_object('proposal_id',s.proposal_id,'token_budget',3500),'gate2-authoring-'||s.proposal_id::text,'gate2_operations',1,'queued',1,s.authoring_step_id
 from public.hq_workforce_tool_contracts t where t.tool_key='content.authoring.source_grounded' and t.version=1 and t.status='approved'
 returning id into v_task;
 update public.hq_content_factory_r2_canary_sessions set authoring_task_id=v_task,status='authoring_bound',evidence=evidence||jsonb_build_object('semantic_reconciliation',v_rec) where id=s.id;
 return jsonb_build_object('session_id',s.id,'authoring_task_id',v_task,'reconciliation',v_rec);
end $$;

create or replace function public.hq_content_factory_r2_canary_consume_invocation(p_token text,p_phase text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hq_content_factory_r2_canary_sessions%rowtype; v_sha text; v_task uuid; v_expected text; v_next text; begin
 v_sha:=encode(extensions.digest(convert_to(coalesce(p_token,''),'UTF8'),'sha256'),'hex');
 select * into s from public.hq_content_factory_r2_canary_sessions where token_sha256=v_sha and expires_at>clock_timestamp() for update;
 if not found then raise exception 'gate2_invocation_token_denied'; end if;
 if p_phase='research' then v_expected:='prepared'; v_next:='research_dispatched'; v_task:=s.research_task_id;
 elsif p_phase='semantic' then v_expected:='semantic_bound'; v_next:='semantic_dispatched'; v_task:=s.semantic_task_id;
 elsif p_phase='authoring' then v_expected:='authoring_bound'; v_next:='authoring_dispatched'; v_task:=s.authoring_task_id;
 else raise exception 'gate2_invocation_phase_denied'; end if;
 if s.status<>v_expected or v_task is null then raise exception 'gate2_invocation_state_denied:%:%',s.status,p_phase; end if;
 update public.hq_content_factory_r2_canary_sessions set status=v_next,evidence=evidence||jsonb_build_object(p_phase||'_dispatched_at',clock_timestamp()) where id=s.id;
 return jsonb_build_object('session_id',s.id,'phase',p_phase,'task_id',v_task);
end $$;

create or replace function public.hq_content_factory_r2_operator_finalize_canary(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.hq_content_factory_r2_canary_sessions%rowtype; v_now timestamptz:=clock_timestamp(); v_current_sha text; v_creation uuid; v_draft uuid; begin
 if session_user<>'postgres' then raise exception 'gate2_operator_postgres_required'; end if;
 select * into s from public.hq_content_factory_r2_canary_sessions where id=p_session_id for update;
 if not found or s.status<>'authoring_dispatched' then raise exception 'gate2_finalize_session_denied'; end if;
 if not exists(select 1 from public.hq_workforce_task_contracts where id=s.authoring_task_id and status='completed') then raise exception 'gate2_authoring_task_not_completed'; end if;
 select id into v_draft from public.curriculum_authoring_drafts where task_id=s.authoring_task_id and proposal_id=s.proposal_id order by created_at desc limit 1;
 if v_draft is null then raise exception 'gate2_authoring_draft_missing'; end if;
 select encode(extensions.digest(convert_to(coalesce(plain_text,''),'UTF8'),'sha256'),'hex') into v_current_sha from public.content_blocks where id=s.target_block_id;
 if v_current_sha is distinct from s.target_block_sha256 then raise exception 'gate2_target_content_mutated'; end if;
 if exists(select 1 from public.curriculum_intelligence_proposals where id=s.proposal_id and (applied_at is not null or status='applied')) then raise exception 'gate2_human_acceptance_boundary_breached'; end if;

 update public.hq_workforce_engine_contract set runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,runtime_max_concurrency=1,runtime_max_executions_per_minute=1,
   runtime_anomaly_paused=false,heartbeat_enabled=false,factory_enabled=false,shadow_enabled=false,shadow_scheduler_enabled=false,shadow_global_stop=true,updated_at=v_now where singleton=true;
 update public.hq_workforce_runtime_policies set enabled=false,status='revoked',reason=reason||' — Gate 2 canary complete',updated_at=v_now where policy_key in ('content-factory-r2-gate2-global','content-factory-r2-gate2-worker');
 update public.hq_workforce_capability_grants set status='revoked',revoked_at=v_now,revocation_reason='Gate 2 canary complete' where worker_key=s.worker_key and status='active';
 update public.hq_workforce_capability_authority_grants set status='revoked',revoked_at=v_now,revocation_reason='Gate 2 canary complete',lifecycle_reason='Gate 2 canary complete',lifecycle_evidence=lifecycle_evidence||jsonb_build_array(jsonb_build_object('revoked_at',v_now,'actor','system:postgres')) where permitted_worker_key=s.worker_key and status='active';
 update public.hq_workforce_identities set status='revoked',revoked_at=v_now,revocation_reason='Gate 2 canary complete' where worker_key=s.worker_key and status='active';
 update public.hq_workforce_execution_budgets set status='closed',period_end=least(period_end,v_now) where worker_key=s.worker_key and status='active';
 update public.hq_workforce_workers set paid_ai_allowed=false where worker_key=s.worker_key;
 select id into v_creation from public.hq_workforce_creation_contracts where worker_key=s.worker_key and status in ('issued','consumed') and (expires_at is null or expires_at>v_now) order by issued_at desc limit 1;
 perform public.hq_workforce_transition_worker(s.worker_key,'suspended','Gate 2 canary authority revoked',null);
 perform public.hq_workforce_transition_worker(s.worker_key,'remediation','Gate 2 post-canary certification restoration',null);
 perform public.hq_workforce_transition_worker(s.worker_key,'certification_pending','Gate 2 post-canary recertification boundary',v_creation);
 perform public.hq_workforce_transition_worker(s.worker_key,'certified','Gate 2 canary completed with target content unchanged',v_creation);
 update public.hq_content_factory_r2_canary_sessions set status='completed',draft_id=v_draft,completed_at=v_now,evidence=evidence||jsonb_build_object('draft_id',v_draft,'target_block_unchanged',true,'authority_revoked',true,'runtime_fail_closed',true) where id=s.id;
 return jsonb_build_object('status','completed','session_id',s.id,'draft_id',v_draft,'target_block_unchanged',true,'runtime_fail_closed',true);
exception when others then
 update public.hq_workforce_engine_contract set runtime_execution_enabled=false,runtime_autonomy_level=0,runtime_max_risk=0,heartbeat_enabled=false,factory_enabled=false,shadow_global_stop=true,updated_at=clock_timestamp() where singleton=true;
 raise;
end $$;

revoke all on function public.hq_content_factory_r2_operator_prepare_canary() from public,anon,authenticated,service_role;
revoke all on function public.hq_content_factory_r2_operator_bind_semantic(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_content_factory_r2_operator_bind_authoring(uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_content_factory_r2_operator_finalize_canary(uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_content_factory_r2_canary_consume_invocation(text,text) from public,anon,authenticated;
grant execute on function public.hq_content_factory_r2_canary_consume_invocation(text,text) to service_role;
