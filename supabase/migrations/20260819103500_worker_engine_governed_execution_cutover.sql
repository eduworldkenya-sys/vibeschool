-- Worker Engine governed execution cutover.
-- Historical rows are preserved and classified; no historical verification is fabricated.

alter table public.hq_workforce_runs
  add column if not exists task_id uuid references public.hq_workforce_task_contracts(id) on delete restrict,
  add column if not exists execution_intent_id uuid references public.hq_workforce_execution_intents(id) on delete restrict,
  add column if not exists authority_grant_id uuid references public.hq_workforce_capability_authority_grants(id) on delete restrict,
  add column if not exists scope_type text,
  add column if not exists scope_ref jsonb,
  add column if not exists governance_status text not null default 'legacy_pre_governance',
  add column if not exists governance_cutover_version text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.hq_workforce_runs'::regclass
      and conname='hq_workforce_runs_governance_status_check'
  ) then
    alter table public.hq_workforce_runs
      add constraint hq_workforce_runs_governance_status_check
      check (governance_status in (
        'legacy_pre_governance','intent_reserved','executed_pending_verification',
        'verified_success','verified_failure','governance_unverified'
      ));
  end if;
end $$;

create unique index if not exists uq_hq_workforce_runs_task_id_governed
  on public.hq_workforce_runs(task_id);
create unique index if not exists uq_hq_workforce_runs_execution_intent_id
  on public.hq_workforce_runs(execution_intent_id) where execution_intent_id is not null;
create index if not exists ix_hq_workforce_runs_scope
  on public.hq_workforce_runs(scope_type);

update public.hq_workforce_runs
   set governance_status='legacy_pre_governance',
       governance_cutover_version=null
 where task_id is null
   and execution_intent_id is null;

create or replace function public.hq_workforce_content_resource_identity(p_task public.hq_workforce_task_contracts)
returns jsonb
language plpgsql
immutable
set search_path=public,pg_temp
as $$
begin
  case p_task.capability_key
    when 'content.research.execute' then
      if nullif(p_task.payload->>'research_job_id','') is null then
        raise exception 'content_governance_research_resource_missing';
      end if;
      return jsonb_build_object(
        'resource_type',p_task.resource_type,
        'research_job_id',p_task.payload->>'research_job_id'
      );
    when 'content.evidence.semantic_verify' then
      if nullif(p_task.payload->>'source_id','') is null then
        raise exception 'content_governance_semantic_resource_missing';
      end if;
      return jsonb_build_object(
        'resource_type',p_task.resource_type,
        'source_id',p_task.payload->>'source_id'
      );
    when 'content.authoring.source_grounded' then
      if nullif(p_task.payload->>'proposal_id','') is null then
        raise exception 'content_governance_authoring_resource_missing';
      end if;
      return jsonb_build_object(
        'resource_type',p_task.resource_type,
        'proposal_id',p_task.payload->>'proposal_id'
      );
    else
      raise exception 'content_governance_capability_unsupported';
  end case;
end $$;

create or replace function public.hq_workforce_verify_content_execution_internal(
  p_task_id uuid,
  p_verifier_key text default 'worker-engine-governance-v1'
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  i public.hq_workforce_execution_intents%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  v_expected jsonb;
  v_observed jsonb;
  v_pass boolean := false;
  v_id uuid;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'content_verification_task_not_found'; end if;
  if t.status <> 'completed' then raise exception 'content_verification_task_not_completed'; end if;
  if t.verification_status <> 'pending' then raise exception 'content_verification_task_already_finalized'; end if;

  select * into i from public.hq_workforce_execution_intents where task_id=t.id for update;
  if not found then raise exception 'content_verification_execution_intent_missing'; end if;
  if i.status <> 'committed' then raise exception 'content_verification_execution_intent_not_committed'; end if;
  if i.verification_status <> 'pending' then raise exception 'content_verification_intent_already_finalized'; end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=i.authority_grant_id;
  if not found then raise exception 'content_verification_authority_missing'; end if;
  if not g.verification_required or g.verification_contract='{}'::jsonb then
    raise exception 'content_verification_contract_missing';
  end if;

  if i.authority_grant_id is distinct from t.autonomous_authority_grant_id
     or i.plan_step_id is distinct from t.plan_step_id
     or i.capability_key is distinct from t.capability_key
     or i.capability_version is distinct from t.capability_version
     or i.scope_type is distinct from t.scope_type
     or i.scope_ref is distinct from t.scope_ref then
    raise exception 'content_verification_lineage_mismatch';
  end if;

  v_observed := coalesce(t.execution_evidence,'{}'::jsonb);

  case t.capability_key
    when 'content.research.execute' then
      v_expected := jsonb_build_object(
        'research_job_id',t.payload->>'research_job_id',
        'required_keys',jsonb_build_array('research_job_id','research_status','verification_boundary'),
        'human_boundary_required',true
      );
      v_pass :=
        v_observed->>'research_job_id' = t.payload->>'research_job_id'
        and v_observed ?& array['research_job_id','research_status','verification_boundary']
        and v_observed->>'verification_boundary' = 'human_review_required';

    when 'content.evidence.semantic_verify' then
      v_expected := jsonb_build_object(
        'source_id',t.payload->>'source_id',
        'required_keys',jsonb_build_array(
          'source_id','verdict','verdict_id','model_invocation_id',
          'structured_output_sha256','verifier_version'
        ),
        'allowed_verdicts',jsonb_build_array('supported','refuted','insufficient')
      );
      v_pass :=
        v_observed->>'source_id' = t.payload->>'source_id'
        and v_observed ?& array[
          'source_id','verdict','verdict_id','model_invocation_id',
          'structured_output_sha256','verifier_version'
        ]
        and v_observed->>'verdict' in ('supported','refuted','insufficient')
        and v_observed->>'verifier_version' = 'certified_semantic_verifier_v1';

    when 'content.authoring.source_grounded' then
      v_expected := jsonb_build_object(
        'proposal_id',t.payload->>'proposal_id',
        'required_keys',jsonb_build_array(
          'proposal_id','authoring_draft_id','evidence_packet_sha256',
          'structured_output_sha256','outcome'
        ),
        'required_outcome','draft_requires_human_acceptance'
      );
      v_pass :=
        v_observed->>'proposal_id' = t.payload->>'proposal_id'
        and v_observed ?& array[
          'proposal_id','authoring_draft_id','evidence_packet_sha256',
          'structured_output_sha256','outcome'
        ]
        and v_observed->>'outcome' = 'draft_requires_human_acceptance';

    else
      raise exception 'content_verification_capability_unsupported';
  end case;

  insert into public.hq_workforce_execution_verifications(
    intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
    verifier_key,expected_outcome,observed_outcome,verification_contract,passed
  ) values (
    i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
    btrim(p_verifier_key),v_expected,v_observed,g.verification_contract,v_pass
  )
  returning id into v_id;

  update public.hq_workforce_execution_intents
     set verification_status=case when v_pass then 'passed' else 'failed' end,
         verified_at=clock_timestamp()
   where id=i.id;

  update public.hq_workforce_task_contracts
     set verification_status=case when v_pass then 'verified' else 'failed' end
   where id=t.id;

  update public.hq_workforce_runs
     set status=case when v_pass then 'verified' else 'failed' end,
         governance_status=case when v_pass then 'verified_success' else 'verified_failure' end,
         execution_evidence=coalesce(execution_evidence,'{}'::jsonb) ||
           jsonb_build_object(
             'execution_verification_id',v_id,
             'verification_passed',v_pass,
             'verification_at',clock_timestamp()
           ),
         completed_at=coalesce(completed_at,clock_timestamp())
   where task_id=t.id;

  return v_id;
end $$;

create or replace function public.hq_workforce_mirror_task_verification()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ev public.hq_workforce_execution_verifications%rowtype;
begin
  if old.verification_status='pending'
     and new.verification_status in ('verified','failed') then
    select * into ev
      from public.hq_workforce_execution_verifications
     where task_id=new.id;
    if found then
      insert into public.hq_workforce_task_verifications(
        task_id,verifier_key,expected_outcome,observed_outcome,passed
      ) values (
        new.id,ev.verifier_key,ev.expected_outcome,ev.observed_outcome,ev.passed
      )
      on conflict(task_id) do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_mirror_task_verification
  on public.hq_workforce_task_contracts;
create trigger trg_hq_workforce_mirror_task_verification
after update of verification_status on public.hq_workforce_task_contracts
for each row execute function public.hq_workforce_mirror_task_verification();

create or replace function public.hq_workforce_content_governance_transition()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_intent jsonb;
  v_intent_id uuid;
  v_worker_id uuid;
  v_resource_identity jsonb;
  v_precondition jsonb;
  v_desired jsonb;
begin
  if new.capability_key not in (
    'content.research.execute',
    'content.evidence.semantic_verify',
    'content.authoring.source_grounded'
  ) then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  if old.status in ('queued','failed') and new.status='running' then
    if new.autonomous_authority_grant_id is null
       or new.plan_step_id is null
       or new.capability_version is null then
      raise exception 'content_governance_authority_lineage_missing';
    end if;

    select id into v_intent_id
      from public.hq_workforce_execution_intents
     where task_id=new.id and status='reserved'
     for update;

    v_resource_identity := public.hq_workforce_content_resource_identity(new);
    v_precondition := jsonb_build_object(
      'task_id',new.id,
      'task_key',new.task_key,
      'prior_status',old.status,
      'attempt_count',new.attempt_count,
      'payload_sha256',encode(digest(new.payload::text,'sha256'),'hex'),
      'scope_type',new.scope_type,
      'scope_ref',new.scope_ref
    );
    v_desired := jsonb_build_object(
      'terminal_status','completed',
      'verification_required',true,
      'human_acceptance_required',
        new.capability_key='content.authoring.source_grounded'
    );

    if v_intent_id is null then
      v_intent := public.hq_workforce_reserve_execution_intent(
        new.id,new.autonomous_authority_grant_id,
        v_resource_identity,v_precondition,v_desired
      );
      v_intent_id := nullif(v_intent->>'intent_id','')::uuid;
      if v_intent_id is null then raise exception 'content_governance_intent_missing'; end if;
    else
      if not exists (
        select 1
          from public.hq_workforce_execution_intents i
         where i.id=v_intent_id
           and i.authority_grant_id=new.autonomous_authority_grant_id
           and i.plan_step_id=new.plan_step_id
           and i.capability_key=new.capability_key
           and i.capability_version=new.capability_version
           and i.scope_type=new.scope_type
           and i.scope_ref=new.scope_ref
      ) then
        raise exception 'content_governance_retry_lineage_mismatch';
      end if;
    end if;

    select id into v_worker_id
      from public.hq_workforce_workers
     where worker_key=new.worker_key;
    if v_worker_id is null then raise exception 'content_governance_worker_missing'; end if;

    insert into public.hq_workforce_runs(
      lane_key,worker_id,trigger_type,status,authority_result,execution_evidence,
      started_at,task_id,execution_intent_id,authority_grant_id,scope_type,scope_ref,
      governance_status,governance_cutover_version
    ) values (
      'curriculum-intelligence',v_worker_id,
      case when new.attempt_count>1 then 'retry' else 'event' end,
      'running','allow',
      jsonb_build_object(
        'governance','worker_engine_governed_execution_v1',
        'task_id',new.id,
        'execution_intent_id',v_intent_id,
        'authority_grant_id',new.autonomous_authority_grant_id,
        'scope_type',new.scope_type,
        'scope_ref',new.scope_ref
      ),
      clock_timestamp(),new.id,v_intent_id,new.autonomous_authority_grant_id,
      new.scope_type,new.scope_ref,'intent_reserved','WE-GOV-1'
    )
    on conflict(task_id) do update
      set execution_intent_id=excluded.execution_intent_id,
          authority_grant_id=excluded.authority_grant_id,
          scope_type=excluded.scope_type,
          scope_ref=excluded.scope_ref,
          status='running',
          governance_status='intent_reserved',
          governance_cutover_version='WE-GOV-1',
          started_at=clock_timestamp(),
          completed_at=null;
    return new;
  end if;

  if old.status='running' and new.status='completed' then
    select id into v_intent_id
      from public.hq_workforce_execution_intents
     where task_id=new.id for update;
    if v_intent_id is null then raise exception 'content_governance_terminal_intent_missing'; end if;
    if coalesce(new.execution_evidence,'{}'::jsonb)='{}'::jsonb then
      raise exception 'content_governance_terminal_evidence_missing';
    end if;

    perform public.hq_workforce_commit_execution_intent(
      v_intent_id,
      jsonb_build_object(
        'task_status','completed',
        'execution_evidence',new.execution_evidence
      )
    );

    update public.hq_workforce_runs
       set status='completed',
           governance_status='executed_pending_verification',
           execution_evidence=execution_evidence ||
             jsonb_build_object('terminal_task_evidence',new.execution_evidence),
           completed_at=clock_timestamp()
     where task_id=new.id;

    perform public.hq_workforce_verify_content_execution_internal(new.id);
    return new;
  end if;

  if old.status='running' and new.status in ('failed','dead_letter','cancelled') then
    select id into v_intent_id
      from public.hq_workforce_execution_intents
     where task_id=new.id for update;
    if v_intent_id is null then raise exception 'content_governance_failure_intent_missing'; end if;

    perform public.hq_workforce_commit_execution_intent(
      v_intent_id,
      jsonb_build_object(
        'task_status',new.status,
        'error',coalesce(new.last_error,'worker_execution_failed'),
        'execution_evidence',coalesce(new.execution_evidence,'{}'::jsonb)
      )
    );

    insert into public.hq_workforce_execution_verifications(
      intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
      verifier_key,expected_outcome,observed_outcome,verification_contract,passed
    )
    select
      i.id,new.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
      'worker-engine-governance-v1',
      jsonb_build_object('terminal_status','completed'),
      jsonb_build_object('terminal_status',new.status,'error',coalesce(new.last_error,'worker_execution_failed')),
      g.verification_contract,false
    from public.hq_workforce_execution_intents i
    join public.hq_workforce_capability_authority_grants g on g.id=i.authority_grant_id
    where i.id=v_intent_id
    on conflict(intent_id) do nothing;

    update public.hq_workforce_execution_intents
       set verification_status='failed',verified_at=clock_timestamp()
     where id=v_intent_id;

    update public.hq_workforce_task_contracts
       set verification_status='failed'
     where id=new.id;

    update public.hq_workforce_runs
       set status='failed',
           governance_status='verified_failure',
           completed_at=clock_timestamp(),
           execution_evidence=execution_evidence ||
             jsonb_build_object('terminal_status',new.status,'error',coalesce(new.last_error,'worker_execution_failed'))
     where task_id=new.id;
    return new;
  end if;

  return new;
end $$;

drop trigger if exists trg_hq_workforce_content_governance_transition
  on public.hq_workforce_task_contracts;
create trigger trg_hq_workforce_content_governance_transition
after update of status on public.hq_workforce_task_contracts
for each row execute function public.hq_workforce_content_governance_transition();

-- Keep these functions private to the control plane.
revoke all on function public.hq_workforce_content_resource_identity(public.hq_workforce_task_contracts) from public,anon,authenticated;
revoke all on function public.hq_workforce_verify_content_execution_internal(uuid,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_mirror_task_verification() from public,anon,authenticated;
revoke all on function public.hq_workforce_content_governance_transition() from public,anon,authenticated;
grant execute on function public.hq_workforce_content_resource_identity(public.hq_workforce_task_contracts) to service_role;
grant execute on function public.hq_workforce_verify_content_execution_internal(uuid,text) to service_role;

comment on column public.hq_workforce_runs.governance_status is
'Execution governance classification. Historical rows remain legacy_pre_governance; post-cutover consequential rows must carry task/intent/grant/scope lineage.';
