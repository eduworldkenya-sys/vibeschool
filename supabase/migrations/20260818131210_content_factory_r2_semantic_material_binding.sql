-- Content Factory R2.2.1: semantic-verifier material binding hardening.
-- Search-result snippets are candidate evidence only. A certified semantic verdict must be
-- bound to independently retrieved source material whose hash is computed inside PostgreSQL.
-- NON-ACTIVATING.
-- access: service-only public.curriculum_semantic_materials
-- authorization-test: public.curriculum_semantic_materials denies public/anon/authenticated direct access.

create table if not exists public.curriculum_semantic_materials (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.curriculum_intelligence_sources(id) on delete restrict,
  source_url text not null check (btrim(source_url)<>''),
  retrieval_method text not null check (retrieval_method in ('direct_https','tavily_extract')),
  material_sha256 text not null check (material_sha256 ~ '^[0-9a-f]{64}$'),
  material_text text not null check (char_length(material_text) between 32 and 12000),
  retrieved_at timestamptz not null default clock_timestamp(),
  unique(source_id,material_sha256,retrieval_method)
);

create index if not exists curriculum_semantic_materials_source_idx
  on public.curriculum_semantic_materials(source_id,retrieved_at desc);

alter table public.curriculum_semantic_materials enable row level security;
revoke all on table public.curriculum_semantic_materials from public,anon,authenticated,service_role;
grant select,insert on table public.curriculum_semantic_materials to service_role;

create or replace function public.curriculum_semantic_material_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'curriculum_semantic_material_immutable';
end $$;
drop trigger if exists curriculum_semantic_material_immutable_trigger on public.curriculum_semantic_materials;
create trigger curriculum_semantic_material_immutable_trigger
before update or delete on public.curriculum_semantic_materials
for each row execute function public.curriculum_semantic_material_immutable();
revoke all on function public.curriculum_semantic_material_immutable() from public,anon,authenticated,service_role;

alter table public.curriculum_semantic_verdicts
  add column if not exists material_id uuid references public.curriculum_semantic_materials(id) on delete restrict;
alter table public.curriculum_semantic_verdicts
  alter column material_id set not null;

-- The first R2.2 draft signatures only bound the model to the search-candidate hash. They are
-- retained for migration-history readability but made non-callable; only material-bound
-- overloads below are executable by service_role.
revoke all on function public.hq_content_semantic_verifier_claim(uuid,uuid,text,bigint)
  from public,anon,authenticated,service_role;
revoke all on function public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,text,numeric,text,text,jsonb)
  from public,anon,authenticated,service_role;

create or replace function public.hq_content_semantic_verifier_claim(
  p_task_id uuid,
  p_source_id uuid,
  p_retrieval_method text,
  p_material_text text,
  p_model_key text,
  p_token_budget bigint default 4000
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
  m public.curriculum_semantic_materials%rowtype;
  v_invocation uuid;
  v_auth jsonb;
  v_claim_sha text;
  v_material_sha text;
  v_runtime boolean;
  v_paused boolean;
begin
  if p_token_budget<500 or p_token_budget>6000 then raise exception 'semantic_verifier_token_budget_out_of_range'; end if;
  if coalesce(btrim(p_model_key),'')='' then raise exception 'semantic_verifier_model_key_required'; end if;
  if p_retrieval_method not in ('direct_https','tavily_extract') then raise exception 'semantic_verifier_retrieval_method_denied'; end if;
  if char_length(coalesce(p_material_text,''))<32 or char_length(p_material_text)>12000 then
    raise exception 'semantic_verifier_material_size_invalid';
  end if;

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
  if s.url !~ '^https://' then raise exception 'semantic_verifier_https_source_required'; end if;
  select * into p from public.curriculum_intelligence_proposals where id=s.proposal_id;
  if not found or coalesce(btrim(p.claim),'')='' then raise exception 'semantic_verifier_claim_required'; end if;

  v_claim_sha:=encode(extensions.digest(convert_to(btrim(p.claim),'UTF8'),'sha256'),'hex');
  v_material_sha:=encode(extensions.digest(convert_to(p_material_text,'UTF8'),'sha256'),'hex');

  if exists(
    select 1 from public.curriculum_semantic_verdicts v
    where v.source_id=s.id and v.claim_sha256=v_claim_sha
      and v.source_content_hash=v_material_sha and v.verifier_version='certified_semantic_verifier_v1'
  ) then raise exception 'semantic_verifier_exact_material_already_verified'; end if;

  update public.hq_workforce_task_contracts
     set status='running',attempt_count=attempt_count+1,
         started_at=coalesce(started_at,clock_timestamp()),
         lease_expires_at=clock_timestamp()+interval '10 minutes',last_error=null
   where id=t.id;

  v_auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);

  select * into m from public.curriculum_semantic_materials
   where source_id=s.id and material_sha256=v_material_sha and retrieval_method=p_retrieval_method;
  if not found then
    insert into public.curriculum_semantic_materials(
      source_id,source_url,retrieval_method,material_sha256,material_text
    ) values(s.id,s.url,p_retrieval_method,v_material_sha,p_material_text)
    returning * into m;
  end if;

  v_invocation:=public.hq_workforce_authorize_model_call(
    t.worker_key,t.id,'semantic_ambiguity',
    jsonb_build_object(
      'deterministic_attempted',true,
      'reason','retrieved source material requires claim-support classification',
      'source_id',s.id,'material_id',m.id,'material_sha256',m.material_sha256,
      'retrieval_method',m.retrieval_method,'claim_sha256',v_claim_sha
    ),
    p_model_key,p_token_budget
  );

  return jsonb_build_object(
    'decision','allow','task_id',t.id,'source_id',s.id,'proposal_id',p.id,
    'worker_key',t.worker_key,'model_invocation_id',v_invocation,'model_key',p_model_key,
    'token_budget',p_token_budget,'claim',p.claim,'claim_sha256',v_claim_sha,
    'source_url',s.url,'source_title',s.title,'source_type',s.source_type,
    'material_id',m.id,'material_sha256',m.material_sha256,'retrieval_method',m.retrieval_method,
    'authority',v_auth
  );
end $$;

create or replace function public.hq_content_semantic_verifier_complete(
  p_task_id uuid,
  p_source_id uuid,
  p_material_id uuid,
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
  m public.curriculum_semantic_materials%rowtype;
  i public.hq_workforce_model_invocations%rowtype;
  v_claim_sha text;
  v_output_sha text;
  v_verdict_id uuid;
  v_material_norm text;
  v_excerpt_norm text;
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
  select * into m from public.curriculum_semantic_materials where id=p_material_id;
  if not found or m.source_id<>s.id then raise exception 'semantic_verifier_material_binding_mismatch'; end if;
  select * into i from public.hq_workforce_model_invocations where id=p_model_invocation_id for update;
  if not found or i.status<>'authorized' then raise exception 'semantic_verifier_model_invocation_not_authorized'; end if;
  if i.task_id is distinct from t.id or i.worker_key<>t.worker_key then raise exception 'semantic_verifier_model_invocation_binding_mismatch'; end if;
  if coalesce(i.deterministic_failure_evidence->>'material_id','')<>m.id::text
     or coalesce(i.deterministic_failure_evidence->>'material_sha256','')<>m.material_sha256 then
    raise exception 'semantic_verifier_model_material_evidence_mismatch';
  end if;

  if p_verdict in ('supported','refuted') then
    v_material_norm:=lower(regexp_replace(btrim(m.material_text),'[[:space:]]+',' ','g'));
    v_excerpt_norm:=lower(regexp_replace(btrim(p_evidence_excerpt),'[[:space:]]+',' ','g'));
    if char_length(v_excerpt_norm)<8 or position(v_excerpt_norm in v_material_norm)=0 then
      raise exception 'semantic_verifier_excerpt_not_grounded_in_material';
    end if;
  end if;

  v_claim_sha:=encode(extensions.digest(convert_to(btrim(p.claim),'UTF8'),'sha256'),'hex');
  v_output_sha:=encode(extensions.digest(convert_to(p_structured_output::text,'UTF8'),'sha256'),'hex');

  insert into public.curriculum_semantic_verdicts(
    proposal_id,source_id,task_id,model_invocation_id,verifier_version,
    claim_sha256,source_content_hash,verdict,confidence,evidence_excerpt,rationale,
    model_key,token_budget,structured_output_sha256,material_id
  ) values (
    p.id,s.id,t.id,i.id,'certified_semantic_verifier_v1',v_claim_sha,m.material_sha256,
    p_verdict,p_confidence,nullif(btrim(p_evidence_excerpt),''),btrim(p_rationale),
    i.model_key,i.token_budget,v_output_sha,m.id
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
           'material_id',m.id,'material_sha256',m.material_sha256,'retrieval_method',m.retrieval_method,
           'model_invocation_id',i.id,'verifier_version','certified_semantic_verifier_v1',
           'verdict',p_verdict,'confidence',p_confidence,'claim_sha256',v_claim_sha,
           'structured_output_sha256',v_output_sha
         )
   where id=t.id;

  return jsonb_build_object(
    'status','completed','verdict_id',v_verdict_id,'task_id',t.id,'source_id',s.id,
    'material_id',m.id,'material_sha256',m.material_sha256,
    'verdict',p_verdict,'confidence',p_confidence,
    'verification_method','certified_semantic_verifier_v1'
  );
end $$;

revoke all on function public.hq_content_semantic_verifier_claim(uuid,uuid,text,text,text,bigint)
  from public,anon,authenticated;
revoke all on function public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,uuid,text,numeric,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.hq_content_semantic_verifier_claim(uuid,uuid,text,text,text,bigint) to service_role;
grant execute on function public.hq_content_semantic_verifier_complete(uuid,uuid,uuid,uuid,text,numeric,text,text,jsonb) to service_role;
