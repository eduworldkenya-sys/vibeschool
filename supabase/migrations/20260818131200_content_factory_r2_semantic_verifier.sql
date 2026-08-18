-- Content Factory R2.2: certified semantic evidence verifier.
-- NON-ACTIVATING. This migration installs contracts only. It does not enable Worker Engine
-- runtime/autonomy, create active capability authority, invoke a model, or deploy a function.
-- access: service-only public.curriculum_semantic_verdicts
-- authorization-test: public.curriculum_semantic_verdicts denies public/anon/authenticated direct access.

create table if not exists public.curriculum_semantic_verdicts (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.curriculum_intelligence_proposals(id) on delete restrict,
  source_id uuid not null references public.curriculum_intelligence_sources(id) on delete restrict,
  task_id uuid not null references public.hq_workforce_task_contracts(id) on delete restrict,
  model_invocation_id uuid not null unique references public.hq_workforce_model_invocations(id) on delete restrict,
  verifier_version text not null check (verifier_version='certified_semantic_verifier_v1'),
  claim_sha256 text not null check (claim_sha256 ~ '^[0-9a-f]{64}$'),
  source_content_hash text not null,
  verdict text not null check (verdict in ('supported','refuted','insufficient')),
  confidence numeric not null check (confidence>=0 and confidence<=1),
  evidence_excerpt text,
  rationale text not null check (char_length(btrim(rationale)) between 3 and 4000),
  model_key text not null,
  token_budget bigint not null check (token_budget>0),
  structured_output_sha256 text not null check (structured_output_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  unique(source_id,claim_sha256,source_content_hash,verifier_version)
);

create index if not exists curriculum_semantic_verdicts_proposal_idx
  on public.curriculum_semantic_verdicts(proposal_id,created_at desc);
create index if not exists curriculum_semantic_verdicts_task_idx
  on public.curriculum_semantic_verdicts(task_id,created_at desc);

alter table public.curriculum_semantic_verdicts enable row level security;
revoke all on table public.curriculum_semantic_verdicts from public,anon,authenticated,service_role;
grant select,insert on table public.curriculum_semantic_verdicts to service_role;

create or replace function public.curriculum_semantic_verdict_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'curriculum_semantic_verdict_immutable';
end $$;
drop trigger if exists curriculum_semantic_verdict_immutable_trigger on public.curriculum_semantic_verdicts;
create trigger curriculum_semantic_verdict_immutable_trigger
before update or delete on public.curriculum_semantic_verdicts
for each row execute function public.curriculum_semantic_verdict_immutable();

revoke all on function public.curriculum_semantic_verdict_immutable() from public,anon,authenticated,service_role;

-- Preserve all previously certified Worker Engine handlers and add exactly one verifier adapter.
alter table public.hq_workforce_tool_contracts
  drop constraint if exists hq_workforce_tool_contracts_handler_key_check;
alter table public.hq_workforce_tool_contracts
  add constraint hq_workforce_tool_contracts_handler_key_check
  check (handler_key in (
    'work_item.triage_and_own',
    'work_item.prioritize',
    'content.research.external',
    'content.evidence.semantic_verify'
  ));

insert into public.hq_workforce_tool_contracts(
  tool_key,version,title,handler_key,required_capability_key,operation,resource_type,
  side_effect_class,status,approved_at
) values (
  'content.evidence.semantic_verify',1,'Content Factory semantic evidence verifier',
  'content.evidence.semantic_verify','content.evidence.semantic_verify','verify_semantics',
  'curriculum_intelligence_source','internal_write','approved',clock_timestamp()
)
on conflict(tool_key,version) do update set
  title=excluded.title,
  handler_key=excluded.handler_key,
  required_capability_key=excluded.required_capability_key,
  operation=excluded.operation,
  resource_type=excluded.resource_type,
  side_effect_class=excluded.side_effect_class,
  status='approved',
  approved_at=coalesce(public.hq_workforce_tool_contracts.approved_at,clock_timestamp());

-- Claim one exact source-verification task and obtain a Worker Engine model authorization.
create or replace function public.hq_content_semantic_verifier_claim(
  p_task_id uuid,
  p_source_id uuid,
  p_model_key text,
  p_token_budget bigint default 1200
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  s public.curriculum_intelligence_sources%rowtype;
  p public.curriculum_intelligence_proposals%rowtype;
  v_invocation uuid;
  v_auth jsonb;
  v_claim_sha text;
  v_runtime boolean;
  v_paused boolean;
begin
  if p_token_budget<200 or p_token_budget>4000 then raise exception 'semantic_verifier_token_budget_out_of_range'; end if;
  if coalesce(btrim(p_model_key),'')='' then raise exception 'semantic_verifier_model_key_required'; end if;

  select runtime_execution_enabled,runtime_anomaly_paused into v_runtime,v_paused
  from public.hq_workforce_engine_contract where singleton=true;
  if not coalesce(v_runtime,false) then raise exception 'worker_runtime_global_stop'; end if;
  if coalesce(v_paused,false) then raise exception 'worker_runtime_anomaly_paused'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'semantic_verifier_task_not_found'; end if;
  if t.status<>'queued' then raise exception 'semantic_verifier_task_not_queued:%',t.status; end if;
  if t.next_attempt_at>clock_timestamp() then raise exception 'semantic_verifier_task_not_due'; end if;
  if t.payload->>'source_id' is distinct from p_source_id::text then raise exception 'semantic_verifier_task_source_mismatch'; end if;

  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found or tc.handler_key<>'content.evidence.semantic_verify' then raise exception 'semantic_verifier_tool_contract_denied'; end if;
  if t.capability_key<>'content.evidence.semantic_verify'
     or t.operation<>'verify_semantics'
     or t.resource_type<>'curriculum_intelligence_source' then
    raise exception 'semantic_verifier_task_semantics_denied';
  end if;

  select * into s from public.curriculum_intelligence_sources where id=p_source_id;
  if not found then raise exception 'semantic_verifier_source_not_found'; end if;
  if coalesce(btrim(s.content_hash),'')='' then raise exception 'semantic_verifier_source_hash_required'; end if;
  if coalesce(btrim(s.claim_excerpt),'')='' and coalesce(btrim(s.evidence_summary),'')='' then
    raise exception 'semantic_verifier_source_excerpt_required';
  end if;

  select * into p from public.curriculum_intelligence_proposals where id=s.proposal_id;
  if not found then raise exception 'semantic_verifier_proposal_not_found'; end if;
  if coalesce(btrim(p.claim),'')='' then raise exception 'semantic_verifier_claim_required'; end if;

  v_claim_sha:=encode(extensions.digest(convert_to(btrim(p.claim),'UTF8'),'sha256'),'hex');
  if exists(
    select 1 from public.curriculum_semantic_verdicts v
    where v.source_id=s.id and v.claim_sha256=v_claim_sha and v.source_content_hash=s.content_hash
      and v.verifier_version='certified_semantic_verifier_v1'
  ) then raise exception 'semantic_verifier_exact_evidence_already_verified'; end if;

  update public.hq_workforce_task_contracts
     set status='running',attempt_count=attempt_count+1,
         started_at=coalesce(started_at,clock_timestamp()),
         lease_expires_at=clock_timestamp()+interval '10 minutes',last_error=null
   where id=t.id;

  v_auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);
  v_invocation:=public.hq_workforce_authorize_model_call(
    t.worker_key,t.id,'semantic_ambiguity',
    jsonb_build_object(
      'deterministic_attempted',true,
      'reason','candidate source requires claim-support classification',
      'source_id',s.id,
      'source_content_hash',s.content_hash,
      'claim_sha256',v_claim_sha
    ),
    p_model_key,p_token_budget
  );

  return jsonb_build_object(
    'decision','allow','task_id',t.id,'source_id',s.id,'proposal_id',p.id,
    'worker_key',t.worker_key,'model_invocation_id',v_invocation,'model_key',p_model_key,
    'token_budget',p_token_budget,'claim',p.claim,'claim_sha256',v_claim_sha,
    'source_url',s.url,'source_title',s.title,'source_type',s.source_type,
    'source_content_hash',s.content_hash,
    'evidence_excerpt',coalesce(nullif(s.claim_excerpt,''),s.evidence_summary),
    'authority',v_auth
  );
end $$;

-- Persist only validated structured verdicts. The model never writes evidence flags directly.
create or replace function public.hq_content_semantic_verifier_complete(
  p_task_id uuid,
  p_source_id uuid,
  p_model_invocation_id uuid,
  p_verdict text,
  p_confidence numeric,
  p_evidence_excerpt text,
  p_rationale text,
  p_structured_output jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  s public.curriculum_intelligence_sources%rowtype;
  p public.curriculum_intelligence_proposals%rowtype;
  i public.hq_workforce_model_invocations%rowtype;
  v_claim_sha text;
  v_output_sha text;
  v_verdict_id uuid;
begin
  if p_verdict not in ('supported','refuted','insufficient') then raise exception 'semantic_verifier_invalid_verdict'; end if;
  if p_confidence is null or p_confidence<0 or p_confidence>1 then raise exception 'semantic_verifier_invalid_confidence'; end if;
  if coalesce(btrim(p_rationale),'')='' then raise exception 'semantic_verifier_rationale_required'; end if;
  if p_verdict in ('supported','refuted') and p_confidence<0.85 then raise exception 'semantic_verifier_decisive_confidence_below_threshold'; end if;
  if p_verdict in ('supported','refuted') and coalesce(btrim(p_evidence_excerpt),'')='' then raise exception 'semantic_verifier_decisive_excerpt_required'; end if;
  if coalesce(p_structured_output,'{}'::jsonb)='{}'::jsonb then raise exception 'semantic_verifier_structured_output_required'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found or t.status<>'running' then raise exception 'semantic_verifier_task_not_running'; end if;
  select * into s from public.curriculum_intelligence_sources where id=p_source_id for update;
  if not found then raise exception 'semantic_verifier_source_not_found'; end if;
  if t.payload->>'source_id' is distinct from s.id::text then raise exception 'semantic_verifier_completion_source_mismatch'; end if;
  select * into p from public.curriculum_intelligence_proposals where id=s.proposal_id;
  if not found or coalesce(btrim(p.claim),'')='' then raise exception 'semantic_verifier_claim_missing'; end if;
  select * into i from public.hq_workforce_model_invocations where id=p_model_invocation_id for update;
  if not found or i.status<>'authorized' then raise exception 'semantic_verifier_model_invocation_not_authorized'; end if;
  if i.task_id is distinct from t.id or i.worker_key<>t.worker_key then raise exception 'semantic_verifier_model_invocation_binding_mismatch'; end if;

  v_claim_sha:=encode(extensions.digest(convert_to(btrim(p.claim),'UTF8'),'sha256'),'hex');
  if coalesce(btrim(s.content_hash),'')='' then raise exception 'semantic_verifier_source_hash_missing'; end if;
  v_output_sha:=encode(extensions.digest(convert_to(p_structured_output::text,'UTF8'),'sha256'),'hex');

  insert into public.curriculum_semantic_verdicts(
    proposal_id,source_id,task_id,model_invocation_id,verifier_version,
    claim_sha256,source_content_hash,verdict,confidence,evidence_excerpt,rationale,
    model_key,token_budget,structured_output_sha256
  ) values (
    p.id,s.id,t.id,i.id,'certified_semantic_verifier_v1',v_claim_sha,s.content_hash,
    p_verdict,p_confidence,nullif(btrim(p_evidence_excerpt),''),btrim(p_rationale),
    i.model_key,i.token_budget,v_output_sha
  ) returning id into v_verdict_id;

  perform public.hq_workforce_finalize_model_call(i.id,true);

  update public.curriculum_intelligence_sources
     set supports_claim=case when p_verdict='supported' then true when p_verdict='refuted' then false else null end,
         contradicts_claim=(p_verdict='refuted'),
         verification_method='certified_semantic_verifier_v1',
         claim_excerpt=case when p_verdict in ('supported','refuted') then left(btrim(p_evidence_excerpt),4000) else claim_excerpt end
   where id=s.id;

  update public.hq_workforce_task_contracts
     set status='completed',completed_at=clock_timestamp(),lease_expires_at=null,last_error=null,
         execution_evidence=jsonb_build_object(
           'verdict_id',v_verdict_id,'source_id',s.id,'proposal_id',p.id,
           'model_invocation_id',i.id,'verifier_version','certified_semantic_verifier_v1',
           'verdict',p_verdict,'confidence',p_confidence,
           'claim_sha256',v_claim_sha,'source_content_hash',s.content_hash,
           'structured_output_sha256',v_output_sha
         )
   where id=t.id;

  return jsonb_build_object(
    'status','completed','verdict_id',v_verdict_id,'task_id',t.id,'source_id',s.id,
    'verdict',p_verdict,'confidence',p_confidence,'verification_method','certified_semantic_verifier_v1'
  );
end $$;

create or replace function public.hq_content_semantic_verifier_fail(
  p_task_id uuid,
  p_model_invocation_id uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  i public.hq_workforce_model_invocations%rowtype;
  v_exhausted boolean;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'semantic_verifier_task_not_found'; end if;
  select * into i from public.hq_workforce_model_invocations where id=p_model_invocation_id for update;
  if found and i.status='authorized' then
    if i.task_id is distinct from t.id then raise exception 'semantic_verifier_failure_invocation_mismatch'; end if;
    perform public.hq_workforce_finalize_model_call(i.id,false);
  end if;

  v_exhausted:=t.attempt_count>=t.max_attempts;
  update public.hq_workforce_task_contracts
     set status=case when v_exhausted then 'dead_letter' else 'queued' end,
         next_attempt_at=case when v_exhausted then next_attempt_at else clock_timestamp()+make_interval(secs=>least(300,5*(2^greatest(attempt_count-1,0))::integer)) end,
         lease_expires_at=null,last_error=left(coalesce(p_error,'unknown_error'),2000)
   where id=t.id;

  if v_exhausted then
    insert into public.hq_workforce_dead_letters(task_id,worker_key,error_code,error_detail,attempts,payload_snapshot)
    values(t.id,t.worker_key,'CONTENT_SEMANTIC_VERIFY_FAILED',left(coalesce(p_error,'unknown_error'),2000),t.attempt_count,t.payload)
    on conflict(task_id) do update set error_detail=excluded.error_detail,attempts=excluded.attempts,
      payload_snapshot=excluded.payload_snapshot,created_at=clock_timestamp();
  end if;

  return jsonb_build_object('status',case when v_exhausted then 'dead_letter' else 'retry_queued' end,'task_id',t.id);
end $$;

revoke all on function public.hq_content_semantic_verifier_claim(uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,text,numeric,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.hq_content_semantic_verifier_fail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.hq_content_semantic_verifier_claim(uuid,uuid,text,bigint) to service_role;
grant execute on function public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,text,numeric,text,text,jsonb) to service_role;
grant execute on function public.hq_content_semantic_verifier_fail(uuid,uuid,text) to service_role;

-- Installation attestation: adding a verifier cannot activate Worker Engine authority.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'CF-R2.2 requires Worker Engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CF-R2.2 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'CF-R2.2 cannot install with active capability authority'; end if;
end $$;
