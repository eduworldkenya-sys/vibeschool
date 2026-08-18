-- Content Factory R2.1: governed queued-research worker bridge.
--
-- NON-ACTIVATING.
-- This migration deliberately does not enable Worker Engine runtime execution, grant
-- autonomous authority, start heartbeat/Factory, or deploy/invoke any Edge Function.
-- It binds the existing curriculum_research_jobs domain queue to the Worker Engine
-- objective/plan/capability authority chain without creating a competing queue.

alter table public.curriculum_research_jobs
  add column if not exists workforce_task_id uuid references public.hq_workforce_task_contracts(id) on delete restrict,
  add column if not exists workforce_budget_reservation_id uuid references public.hq_workforce_execution_budgets(id) on delete restrict,
  add column if not exists executor_version text,
  add column if not exists execution_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists curriculum_research_jobs_workforce_task_uq
  on public.curriculum_research_jobs(workforce_task_id)
  where workforce_task_id is not null;

-- The original L2 tool-contract schema admitted only triage; R1.4 later widened the
-- structural handler allowlist for the bounded priority canary. R2 extends that existing
-- allowlist by exactly one research adapter. Execution still requires the exact approved
-- tool contract plus the full R1.4 authority chain below.
alter table public.hq_workforce_tool_contracts
  drop constraint if exists hq_workforce_tool_contracts_handler_key_check;
alter table public.hq_workforce_tool_contracts
  add constraint hq_workforce_tool_contracts_handler_key_check
  check (handler_key in ('work_item.triage_and_own','work_item.prioritize','content.research.external'));

insert into public.hq_workforce_tool_contracts(
  tool_key,version,title,handler_key,required_capability_key,operation,resource_type,
  side_effect_class,status,approved_at
) values (
  'content.research.external',1,'Content Factory governed research executor',
  'content.research.external','content.research.execute','research','curriculum_research_job',
  'internal_write','approved',clock_timestamp()
)
on conflict(tool_key,version) do update set
  title=excluded.title,
  required_capability_key=excluded.required_capability_key,
  operation=excluded.operation,
  resource_type=excluded.resource_type,
  side_effect_class=excluded.side_effect_class;

-- Claim exactly the research job named by a fully governed Worker Engine task.
-- The R1.4 assertion requires an approved Objective -> selected Plan -> executable Plan Step
-- -> certified Capability -> certified Skill -> active scoped authority grant. Runtime must
-- also be explicitly enabled. Today production is fail-closed, so this function installs
-- safely but cannot execute until a later controlled activation.
create or replace function public.hq_content_research_claim(
  p_task_id uuid,
  p_job_id uuid,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  j public.curriculum_research_jobs%rowtype;
  v_budget_id uuid;
  v_runtime_enabled boolean;
  v_runtime_paused boolean;
  v_auth jsonb;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'content_research_invalid_lease_seconds';
  end if;

  select runtime_execution_enabled,runtime_anomaly_paused
    into v_runtime_enabled,v_runtime_paused
    from public.hq_workforce_engine_contract
   where singleton=true;
  if not coalesce(v_runtime_enabled,false) then raise exception 'worker_runtime_global_stop'; end if;
  if coalesce(v_runtime_paused,false) then raise exception 'worker_runtime_anomaly_paused'; end if;

  select * into t
    from public.hq_workforce_task_contracts
   where id=p_task_id
   for update;
  if not found then raise exception 'content_research_task_not_found'; end if;
  if t.status <> 'queued' then raise exception 'content_research_task_not_queued:%',t.status; end if;
  if t.next_attempt_at > clock_timestamp() then raise exception 'content_research_task_not_due'; end if;
  if t.payload->>'research_job_id' is distinct from p_job_id::text then
    raise exception 'content_research_task_job_mismatch';
  end if;

  select * into tc
    from public.hq_workforce_tool_contracts
   where id=t.tool_contract_id and status='approved';
  if not found or tc.handler_key <> 'content.research.external' then
    raise exception 'content_research_tool_contract_denied';
  end if;
  if t.capability_key <> 'content.research.execute'
     or t.operation <> 'research'
     or t.resource_type <> 'curriculum_research_job' then
    raise exception 'content_research_task_semantics_denied';
  end if;

  update public.hq_workforce_task_contracts
     set status='running',
         attempt_count=attempt_count+1,
         started_at=coalesce(started_at,clock_timestamp()),
         lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),
         last_error=null
   where id=t.id;

  -- Full R1.4 authorization. Any failure rolls back the transition above.
  v_auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);

  select * into j
    from public.curriculum_research_jobs
   where id=p_job_id
   for update;
  if not found then raise exception 'content_research_job_not_found'; end if;
  if j.status <> 'queued' then raise exception 'content_research_job_not_queued:%',j.status; end if;
  if j.attempt_count >= j.max_attempts then raise exception 'content_research_job_attempts_exhausted'; end if;
  if j.workforce_task_id is not null and j.workforce_task_id <> t.id then
    raise exception 'content_research_job_already_bound';
  end if;

  v_budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);

  update public.curriculum_research_jobs
     set status='running',
         claimed_at=clock_timestamp(),
         claimed_by=t.worker_key,
         attempt_count=attempt_count+1,
         workforce_task_id=t.id,
         workforce_budget_reservation_id=v_budget_id,
         executor_version='content-research-worker-r2.1',
         execution_metadata=coalesce(execution_metadata,'{}'::jsonb)||jsonb_build_object(
           'claimed_at',clock_timestamp(),
           'task_id',t.id,
           'worker_key',t.worker_key,
           'authority',v_auth
         ),
         updated_at=clock_timestamp()
   where id=j.id;

  return jsonb_build_object(
    'decision','allow',
    'task_id',t.id,
    'job_id',j.id,
    'proposal_id',j.proposal_id,
    'worker_key',t.worker_key,
    'research_question',j.research_question,
    'required_source_count',j.required_source_count,
    'require_primary_source',j.require_primary_source,
    'allowed_domains',j.allowed_domains,
    'lease_expires_at',(select lease_expires_at from public.hq_workforce_task_contracts where id=t.id),
    'authorization',v_auth
  );
end $$;

-- Complete only after the domain finalizer has made an evidence_ready/needs_human decision.
create or replace function public.hq_content_research_complete(
  p_task_id uuid,
  p_job_id uuid,
  p_execution_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  j public.curriculum_research_jobs%rowtype;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'content_research_task_not_found'; end if;
  select * into j from public.curriculum_research_jobs where id=p_job_id for update;
  if not found then raise exception 'content_research_job_not_found'; end if;

  if t.status <> 'running' then raise exception 'content_research_task_not_running:%',t.status; end if;
  if j.workforce_task_id is distinct from t.id then raise exception 'content_research_completion_binding_mismatch'; end if;
  if j.status not in ('evidence_ready','needs_human') then
    raise exception 'content_research_domain_not_finalized:%',j.status;
  end if;
  if j.workforce_budget_reservation_id is null then raise exception 'content_research_budget_reservation_missing'; end if;

  perform public.hq_workforce_consume_budget(j.workforce_budget_reservation_id,t.budget_amount);

  update public.curriculum_research_jobs
     set execution_metadata=coalesce(execution_metadata,'{}'::jsonb)||jsonb_build_object(
           'completed_at',clock_timestamp(),
           'task_id',t.id,
           'final_status',j.status,
           'evidence_score',j.evidence_score
         ),
         workforce_budget_reservation_id=null,
         updated_at=clock_timestamp()
   where id=j.id;

  update public.hq_workforce_task_contracts
     set status='completed',
         completed_at=clock_timestamp(),
         lease_expires_at=null,
         last_error=null,
         execution_evidence=coalesce(p_execution_evidence,'{}'::jsonb)||jsonb_build_object(
           'handler','content.research.external',
           'research_job_id',j.id,
           'research_status',j.status,
           'evidence_score',j.evidence_score,
           'verification_boundary',case when j.status='evidence_ready' then 'machine_evidence_gate_passed' else 'human_review_required' end
         )
   where id=t.id;

  return jsonb_build_object('status','completed','task_id',t.id,'job_id',j.id,'research_status',j.status,'evidence_score',j.evidence_score);
end $$;

-- Recover a failed network execution without lying about completion. Budget reservation is
-- released and both queues move together. Exhausted work fails closed into human review /
-- Worker Engine dead-letter rather than retrying forever.
create or replace function public.hq_content_research_fail(
  p_task_id uuid,
  p_job_id uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  j public.curriculum_research_jobs%rowtype;
  v_exhausted boolean;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'content_research_task_not_found'; end if;
  select * into j from public.curriculum_research_jobs where id=p_job_id for update;
  if not found then raise exception 'content_research_job_not_found'; end if;
  if j.workforce_task_id is distinct from t.id then raise exception 'content_research_failure_binding_mismatch'; end if;

  if j.workforce_budget_reservation_id is not null then
    perform public.hq_workforce_release_budget(j.workforce_budget_reservation_id,t.budget_amount);
  end if;
  v_exhausted := t.attempt_count >= t.max_attempts or j.attempt_count >= j.max_attempts;

  update public.curriculum_research_jobs
     set status=case when v_exhausted then 'needs_human' else 'queued' end,
         claimed_at=null,
         claimed_by=null,
         workforce_budget_reservation_id=null,
         execution_metadata=coalesce(execution_metadata,'{}'::jsonb)||jsonb_build_object(
           'failed_at',clock_timestamp(),'task_id',t.id,'error',left(coalesce(p_error,'unknown_error'),1000),'exhausted',v_exhausted
         ),
         updated_at=clock_timestamp()
   where id=j.id;

  update public.hq_workforce_task_contracts
     set status=case when v_exhausted then 'dead_letter' else 'queued' end,
         next_attempt_at=case when v_exhausted then next_attempt_at else clock_timestamp()+make_interval(secs=>least(300,5*(2^greatest(attempt_count-1,0))::integer)) end,
         lease_expires_at=null,
         last_error=left(coalesce(p_error,'unknown_error'),2000)
   where id=t.id;

  if v_exhausted then
    insert into public.hq_workforce_dead_letters(task_id,worker_key,error_code,error_detail,attempts,payload_snapshot)
    values(t.id,t.worker_key,'CONTENT_RESEARCH_FAILED',left(coalesce(p_error,'unknown_error'),2000),t.attempt_count,t.payload)
    on conflict(task_id) do update set
      error_detail=excluded.error_detail,
      attempts=excluded.attempts,
      payload_snapshot=excluded.payload_snapshot,
      created_at=clock_timestamp();
  end if;

  return jsonb_build_object('status',case when v_exhausted then 'needs_human' else 'retry_queued' end,'task_id',t.id,'job_id',j.id);
end $$;

-- Evidence gate repair: source quantity and authority are not sufficient to establish that
-- a claim is supported. Unclassified sources MUST escalate rather than becoming verified.
create or replace function public.finalize_research_job(p_job_id uuid,p_result jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  j public.curriculum_research_jobs%rowtype;
  n int;
  primary_n int;
  supporting_n int;
  unverified_n int;
  contradict_n int;
  avg_auth numeric;
  score numeric;
  verdict text;
begin
  select * into j from public.curriculum_research_jobs where id=p_job_id for update;
  if not found then raise exception 'research_job_not_found'; end if;
  if j.status <> 'running' then raise exception 'research_job_not_running:%',j.status; end if;

  select count(*),
         count(*) filter(where source_tier=1 or source_type in ('official','primary_research','government')),
         count(*) filter(where supports_claim is true and not contradicts_claim),
         count(*) filter(where supports_claim is null),
         count(*) filter(where contradicts_claim),
         coalesce(avg(authority_score),0)
    into n,primary_n,supporting_n,unverified_n,contradict_n,avg_auth
    from public.curriculum_intelligence_sources
   where proposal_id=j.proposal_id;

  score:=least(1,greatest(0,
      (least(supporting_n,j.required_source_count)::numeric/j.required_source_count)*0.45
      + least(avg_auth,1)*0.35
      + (case when not j.require_primary_source or primary_n>0 then .20 else 0 end)
      - least(contradict_n*.20,.40)
      - least(unverified_n*.05,.25)
  ));

  verdict:=case
    when n<j.required_source_count then 'needs_human'
    when supporting_n<j.required_source_count then 'needs_human'
    when unverified_n>0 then 'needs_human'
    when j.require_primary_source and primary_n=0 then 'needs_human'
    when contradict_n>0 then 'needs_human'
    when score>=.80 then 'evidence_ready'
    else 'needs_human'
  end;

  update public.curriculum_research_jobs
     set status=verdict,
         evidence_score=score,
         result=coalesce(p_result,'{}'::jsonb)||jsonb_build_object(
           'source_count',n,
           'supporting_source_count',supporting_n,
           'unverified_source_count',unverified_n,
           'primary_source_count',primary_n,
           'contradiction_count',contradict_n,
           'authority_average',avg_auth,
           'semantic_support_required',true
         ),
         completed_at=clock_timestamp(),
         updated_at=clock_timestamp()
   where id=j.id;

  update public.curriculum_intelligence_proposals
     set verification_status=case when verdict='evidence_ready' then 'verified' else 'insufficient_evidence' end,
         confidence=case when verdict='evidence_ready' then greatest(confidence,score) else least(confidence,score) end,
         editorial_status=case when verdict='evidence_ready' then editorial_status else 'needs_review' end,
         updated_at=clock_timestamp()
   where id=j.proposal_id;

  return jsonb_build_object(
    'status',verdict,
    'evidence_score',score,
    'source_count',n,
    'supporting_source_count',supporting_n,
    'unverified_source_count',unverified_n,
    'primary_source_count',primary_n,
    'contradictions',contradict_n
  );
end $$;

revoke all on function public.hq_content_research_claim(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.hq_content_research_complete(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.hq_content_research_fail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.hq_content_research_claim(uuid,uuid,integer) to service_role;
grant execute on function public.hq_content_research_complete(uuid,uuid,jsonb) to service_role;
grant execute on function public.hq_content_research_fail(uuid,uuid,text) to service_role;

-- Keep the existing research finalizer service/HQ boundary; never reopen it anonymously.
revoke all on function public.finalize_research_job(uuid,jsonb) from public,anon;

-- Fail-closed installation attestation.
do $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'CF-R2.1 requires Worker Engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CF-R2.1 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'CF-R2.1 cannot install with active capability authority'; end if;
end $$;
