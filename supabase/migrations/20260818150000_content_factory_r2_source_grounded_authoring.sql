-- Content Factory R2.3: source-grounded Authoring Worker.
-- NON-ACTIVATING. Installs contracts only; does not enable Worker Engine runtime/autonomy,
-- grant capability authority, deploy an Edge Function, approve a proposal, or publish content.
-- Migration-contract declarations. Executable coverage lives in
-- scripts/sql/content_factory_r2_source_grounded_authoring_verify.sql.
-- access: service-only public.curriculum_authoring_drafts
-- authorization-test: public.curriculum_authoring_drafts

create table if not exists public.curriculum_authoring_drafts (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.curriculum_intelligence_proposals(id) on delete restrict,
  task_id uuid not null references public.hq_workforce_task_contracts(id) on delete restrict,
  model_invocation_id uuid not null unique references public.hq_workforce_model_invocations(id) on delete restrict,
  authoring_version text not null check (authoring_version='source_grounded_authoring_v1'),
  claim_sha256 text not null check (claim_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_packet_sha256 text not null check (evidence_packet_sha256 ~ '^[0-9a-f]{64}$'),
  current_content_sha256 text not null check (current_content_sha256 ~ '^[0-9a-f]{64}$'),
  target_chapter_id uuid not null references public.vibe_chapters(id) on delete restrict,
  target_block_id uuid not null references public.content_blocks(id) on delete restrict,
  target_sequence integer not null check (target_sequence>0),
  expected_current text not null,
  draft_content text not null check (char_length(btrim(draft_content)) between 10 and 12000),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 4000),
  citations jsonb not null check (jsonb_typeof(citations)='array' and jsonb_array_length(citations)>0),
  model_key text not null,
  token_budget bigint not null check (token_budget>0),
  structured_output_sha256 text not null check (structured_output_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists curriculum_authoring_drafts_proposal_idx
  on public.curriculum_authoring_drafts(proposal_id,created_at desc);
create index if not exists curriculum_authoring_drafts_task_idx
  on public.curriculum_authoring_drafts(task_id,created_at desc);

alter table public.curriculum_authoring_drafts enable row level security;
revoke all on table public.curriculum_authoring_drafts from public,anon,authenticated,service_role;
grant select,insert on table public.curriculum_authoring_drafts to service_role;

create or replace function public.curriculum_authoring_draft_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'curriculum_authoring_draft_immutable';
end $$;
drop trigger if exists curriculum_authoring_draft_immutable_trigger on public.curriculum_authoring_drafts;
create trigger curriculum_authoring_draft_immutable_trigger
before update or delete on public.curriculum_authoring_drafts
for each row execute function public.curriculum_authoring_draft_immutable();
revoke all on function public.curriculum_authoring_draft_immutable() from public,anon,authenticated,service_role;

-- Preserve the certified Worker Engine vocabulary and add exactly one bounded authoring adapter.
alter table public.hq_workforce_tool_contracts
  drop constraint if exists hq_workforce_tool_contracts_handler_key_check;
alter table public.hq_workforce_tool_contracts
  add constraint hq_workforce_tool_contracts_handler_key_check
  check (handler_key in (
    'work_item.triage_and_own',
    'work_item.prioritize',
    'content.research.external',
    'content.evidence.semantic_verify',
    'content.authoring.source_grounded'
  ));

insert into public.hq_workforce_tool_contracts(
  tool_key,version,title,handler_key,required_capability_key,operation,resource_type,
  side_effect_class,status,approved_at
) values (
  'content.authoring.source_grounded',1,'Content Factory source-grounded authoring worker',
  'content.authoring.source_grounded','content.authoring.source_grounded','draft_content',
  'curriculum_intelligence_proposal','internal_write','approved',clock_timestamp()
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

-- Build the exact immutable semantic evidence packet the model is allowed to see.
-- Manual verification can keep a research job trustworthy, but machine authoring deliberately
-- requires enough R2.2 material-bound semantic sources to satisfy the research source count.
create or replace function public.hq_content_authoring_evidence_packet(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  j public.curriculum_research_jobs%rowtype;
  v_sources jsonb;
  v_supported integer;
  v_untrusted integer;
  v_contradictions integer;
begin
  select * into j
    from public.curriculum_research_jobs
   where proposal_id=p_proposal_id and status='evidence_ready'
   order by completed_at desc nulls last,created_at desc
   limit 1;
  if not found then raise exception 'authoring_evidence_ready_research_required'; end if;

  select count(*) filter(
           where s.supports_claim is null
              or s.verification_method is null
              or s.verification_method not in ('manual_verified','certified_semantic_verifier_v1')
         ),
         count(*) filter(where s.contradicts_claim)
    into v_untrusted,v_contradictions
    from public.curriculum_intelligence_sources s
   where s.proposal_id=p_proposal_id;
  if v_untrusted>0 then raise exception 'authoring_unverified_source_present'; end if;
  if v_contradictions>0 then raise exception 'authoring_contradiction_present'; end if;

  with latest_supported as (
    select distinct on (s.id)
      s.id as source_id,s.title,s.url,s.source_type,s.source_tier,s.authority_score,
      v.id as verdict_id,v.confidence,v.evidence_excerpt,
      m.id as material_id,m.material_sha256
    from public.curriculum_intelligence_sources s
    join public.curriculum_semantic_verdicts v
      on v.source_id=s.id and v.proposal_id=s.proposal_id
     and v.verifier_version='certified_semantic_verifier_v1'
     and v.verdict='supported'
    join public.curriculum_semantic_materials m on m.id=v.material_id and m.source_id=s.id
    where s.proposal_id=p_proposal_id
      and s.supports_claim is true
      and not s.contradicts_claim
      and s.verification_method='certified_semantic_verifier_v1'
      and coalesce(btrim(v.evidence_excerpt),'')<>''
    order by s.id,v.created_at desc,v.id desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'source_id',source_id,
           'title',title,
           'url',url,
           'source_type',source_type,
           'source_tier',source_tier,
           'authority_score',authority_score,
           'verdict_id',verdict_id,
           'confidence',confidence,
           'evidence_excerpt',evidence_excerpt,
           'material_id',material_id,
           'material_sha256',material_sha256
         ) order by source_id),'[]'::jsonb),count(*)
    into v_sources,v_supported
    from latest_supported;

  if v_supported<j.required_source_count then
    raise exception 'authoring_semantic_source_minimum_not_met:%/%',v_supported,j.required_source_count;
  end if;

  return jsonb_build_object(
    'proposal_id',p_proposal_id,
    'research_job_id',j.id,
    'required_source_count',j.required_source_count,
    'require_primary_source',j.require_primary_source,
    'evidence_score',j.evidence_score,
    'authoring_evidence_policy','material_bound_semantic_support_only_v1',
    'sources',v_sources
  );
end $$;
revoke all on function public.hq_content_authoring_evidence_packet(uuid) from public,anon,authenticated;
grant execute on function public.hq_content_authoring_evidence_packet(uuid) to service_role;

create or replace function public.hq_content_authoring_claim(
  p_task_id uuid,
  p_proposal_id uuid,
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
  p public.curriculum_intelligence_proposals%rowtype;
  b public.content_blocks%rowtype;
  v_packet jsonb;
  v_packet_sha text;
  v_claim_sha text;
  v_current_sha text;
  v_sequence integer;
  v_invocation uuid;
  v_auth jsonb;
  v_runtime boolean;
  v_paused boolean;
begin
  if p_token_budget<800 or p_token_budget>6000 then raise exception 'authoring_token_budget_out_of_range'; end if;
  if coalesce(btrim(p_model_key),'')='' then raise exception 'authoring_model_key_required'; end if;

  select runtime_execution_enabled,runtime_anomaly_paused into v_runtime,v_paused
    from public.hq_workforce_engine_contract where singleton=true;
  if not coalesce(v_runtime,false) then raise exception 'worker_runtime_global_stop'; end if;
  if coalesce(v_paused,false) then raise exception 'worker_runtime_anomaly_paused'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'authoring_task_not_found'; end if;
  if t.status<>'queued' then raise exception 'authoring_task_not_queued:%',t.status; end if;
  if t.next_attempt_at>clock_timestamp() then raise exception 'authoring_task_not_due'; end if;
  if t.payload->>'proposal_id' is distinct from p_proposal_id::text then raise exception 'authoring_task_proposal_mismatch'; end if;

  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found or tc.handler_key<>'content.authoring.source_grounded' then raise exception 'authoring_tool_contract_denied'; end if;
  if t.capability_key<>'content.authoring.source_grounded'
     or t.operation<>'draft_content'
     or t.resource_type<>'curriculum_intelligence_proposal' then
    raise exception 'authoring_task_semantics_denied';
  end if;

  select * into p from public.curriculum_intelligence_proposals where id=p_proposal_id;
  if not found then raise exception 'authoring_proposal_not_found'; end if;
  if p.verification_status<>'verified' then raise exception 'authoring_verified_proposal_required'; end if;
  if p.status not in ('pending_review','approved') then raise exception 'authoring_proposal_status_denied:%',p.status; end if;
  if p.chapter_id is null then raise exception 'authoring_target_chapter_required'; end if;
  if coalesce(btrim(p.claim),'')='' then raise exception 'authoring_claim_required'; end if;

  begin
    v_sequence:=nullif(p.patch->>'sequence','')::integer;
  exception when others then
    raise exception 'authoring_target_sequence_invalid';
  end;
  if v_sequence is null or v_sequence<1 then raise exception 'authoring_target_sequence_required'; end if;
  select * into b from public.content_blocks where chapter_id=p.chapter_id and sequence=v_sequence;
  if not found then raise exception 'authoring_target_block_not_found'; end if;

  v_packet:=public.hq_content_authoring_evidence_packet(p.id);
  v_packet_sha:=encode(extensions.digest(convert_to(v_packet::text,'UTF8'),'sha256'),'hex');
  v_claim_sha:=encode(extensions.digest(convert_to(btrim(p.claim),'UTF8'),'sha256'),'hex');
  v_current_sha:=encode(extensions.digest(convert_to(coalesce(b.plain_text,''),'UTF8'),'sha256'),'hex');

  update public.hq_workforce_task_contracts
     set status='running',attempt_count=attempt_count+1,
         started_at=coalesce(started_at,clock_timestamp()),
         lease_expires_at=clock_timestamp()+interval '10 minutes',last_error=null
   where id=t.id;

  v_auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);
  v_invocation:=public.hq_workforce_authorize_model_call(
    t.worker_key,t.id,'unstructured_synthesis',
    jsonb_build_object(
      'deterministic_attempted',true,
      'reason','verified evidence requires pedagogical source-grounded prose synthesis',
      'proposal_id',p.id,'claim_sha256',v_claim_sha,
      'evidence_packet_sha256',v_packet_sha,
      'current_content_sha256',v_current_sha,
      'target_block_id',b.id,'target_sequence',b.sequence,
      'authoring_version','source_grounded_authoring_v1'
    ),
    p_model_key,p_token_budget
  );

  return jsonb_build_object(
    'decision','allow','task_id',t.id,'proposal_id',p.id,'worker_key',t.worker_key,
    'model_invocation_id',v_invocation,'model_key',p_model_key,'token_budget',p_token_budget,
    'claim',p.claim,'claim_sha256',v_claim_sha,'title',p.title,'rationale',p.rationale,
    'curriculum_relevance',p.curriculum_relevance,
    'target',jsonb_build_object(
      'chapter_id',p.chapter_id,'block_id',b.id,'sequence',b.sequence,
      'legacy_block_id',b.legacy_block_id,'block_type',b.block_type,
      'current_content',coalesce(b.plain_text,''),'current_content_sha256',v_current_sha
    ),
    'evidence_packet',v_packet,'evidence_packet_sha256',v_packet_sha,
    'authority',v_auth
  );
end $$;

create or replace function public.hq_content_authoring_complete(
  p_task_id uuid,
  p_proposal_id uuid,
  p_model_invocation_id uuid,
  p_draft_content text,
  p_rationale text,
  p_citations jsonb,
  p_structured_output jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  p public.curriculum_intelligence_proposals%rowtype;
  b public.content_blocks%rowtype;
  i public.hq_workforce_model_invocations%rowtype;
  v_packet jsonb;
  v_packet_sha text;
  v_claim_sha text;
  v_current_sha text;
  v_output_sha text;
  v_sequence integer;
  v_required integer;
  v_citation_sources integer;
  v_citation jsonb;
  v_packet_source jsonb;
  v_material public.curriculum_semantic_materials%rowtype;
  v_quote text;
  v_quote_norm text;
  v_excerpt_norm text;
  v_material_norm text;
  v_draft_id uuid;
begin
  if char_length(btrim(coalesce(p_draft_content,'')))<10 or char_length(p_draft_content)>12000 then raise exception 'authoring_draft_size_invalid'; end if;
  if char_length(btrim(coalesce(p_rationale,'')))<3 or char_length(p_rationale)>4000 then raise exception 'authoring_rationale_invalid'; end if;
  if jsonb_typeof(coalesce(p_citations,'null'::jsonb))<>'array' or jsonb_array_length(p_citations)=0 then raise exception 'authoring_citations_required'; end if;
  if coalesce(p_structured_output,'{}'::jsonb)='{}'::jsonb then raise exception 'authoring_structured_output_required'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found or t.status<>'running' then raise exception 'authoring_task_not_running'; end if;
  if t.payload->>'proposal_id' is distinct from p_proposal_id::text then raise exception 'authoring_completion_proposal_mismatch'; end if;
  select * into p from public.curriculum_intelligence_proposals where id=p_proposal_id for update;
  if not found or p.verification_status<>'verified' then raise exception 'authoring_verified_proposal_missing'; end if;
  select * into i from public.hq_workforce_model_invocations where id=p_model_invocation_id for update;
  if not found or i.status<>'authorized' then raise exception 'authoring_model_invocation_not_authorized'; end if;
  if i.task_id is distinct from t.id or i.worker_key<>t.worker_key then raise exception 'authoring_model_invocation_binding_mismatch'; end if;

  begin
    v_sequence:=nullif(p.patch->>'sequence','')::integer;
  exception when others then
    raise exception 'authoring_target_sequence_invalid';
  end;
  select * into b from public.content_blocks where chapter_id=p.chapter_id and sequence=v_sequence;
  if not found then raise exception 'authoring_target_block_not_found'; end if;

  v_packet:=public.hq_content_authoring_evidence_packet(p.id);
  v_packet_sha:=encode(extensions.digest(convert_to(v_packet::text,'UTF8'),'sha256'),'hex');
  v_claim_sha:=encode(extensions.digest(convert_to(btrim(p.claim),'UTF8'),'sha256'),'hex');
  v_current_sha:=encode(extensions.digest(convert_to(coalesce(b.plain_text,''),'UTF8'),'sha256'),'hex');
  if coalesce(i.deterministic_failure_evidence->>'evidence_packet_sha256','')<>v_packet_sha
     or coalesce(i.deterministic_failure_evidence->>'current_content_sha256','')<>v_current_sha
     or coalesce(i.deterministic_failure_evidence->>'claim_sha256','')<>v_claim_sha
     or coalesce(i.deterministic_failure_evidence->>'target_block_id','')<>b.id::text then
    raise exception 'authoring_evidence_or_target_changed_since_authorization';
  end if;

  v_required:=(v_packet->>'required_source_count')::integer;
  select count(distinct c->>'source_id') into v_citation_sources from jsonb_array_elements(p_citations) c;
  if v_citation_sources<v_required then raise exception 'authoring_citation_source_minimum_not_met:%/%',v_citation_sources,v_required; end if;

  for v_citation in select value from jsonb_array_elements(p_citations)
  loop
    if jsonb_typeof(v_citation)<>'object' then raise exception 'authoring_citation_shape_invalid'; end if;
    v_quote:=btrim(coalesce(v_citation->>'quote',''));
    if char_length(v_quote)<8 then raise exception 'authoring_citation_quote_too_short'; end if;
    select value into v_packet_source
      from jsonb_array_elements(v_packet->'sources')
     where value->>'source_id'=v_citation->>'source_id'
     limit 1;
    if v_packet_source is null then raise exception 'authoring_citation_source_not_in_authorized_packet'; end if;
    select * into v_material from public.curriculum_semantic_materials
     where id=(v_packet_source->>'material_id')::uuid;
    if not found then raise exception 'authoring_citation_material_missing'; end if;
    v_quote_norm:=lower(regexp_replace(v_quote,'[[:space:]]+',' ','g'));
    v_excerpt_norm:=lower(regexp_replace(btrim(coalesce(v_packet_source->>'evidence_excerpt','')),'[[:space:]]+',' ','g'));
    v_material_norm:=lower(regexp_replace(btrim(v_material.material_text),'[[:space:]]+',' ','g'));
    if position(v_quote_norm in v_excerpt_norm)=0 then raise exception 'authoring_citation_not_in_authorized_excerpt'; end if;
    if position(v_quote_norm in v_material_norm)=0 then raise exception 'authoring_citation_not_in_bound_material'; end if;
  end loop;

  v_output_sha:=encode(extensions.digest(convert_to(p_structured_output::text,'UTF8'),'sha256'),'hex');
  insert into public.curriculum_authoring_drafts(
    proposal_id,task_id,model_invocation_id,authoring_version,claim_sha256,evidence_packet_sha256,
    current_content_sha256,target_chapter_id,target_block_id,target_sequence,expected_current,
    draft_content,rationale,citations,model_key,token_budget,structured_output_sha256
  ) values (
    p.id,t.id,i.id,'source_grounded_authoring_v1',v_claim_sha,v_packet_sha,v_current_sha,
    p.chapter_id,b.id,b.sequence,coalesce(b.plain_text,''),btrim(p_draft_content),btrim(p_rationale),
    p_citations,i.model_key,i.token_budget,v_output_sha
  ) returning id into v_draft_id;

  perform public.hq_workforce_finalize_model_call(i.id,true);
  update public.hq_workforce_task_contracts
     set status='completed',completed_at=clock_timestamp(),lease_expires_at=null,last_error=null,
         execution_evidence=jsonb_build_object(
           'authoring_draft_id',v_draft_id,'proposal_id',p.id,
           'authoring_version','source_grounded_authoring_v1','claim_sha256',v_claim_sha,
           'evidence_packet_sha256',v_packet_sha,'current_content_sha256',v_current_sha,
           'target_block_id',b.id,'citation_source_count',v_citation_sources,
           'model_invocation_id',i.id,'structured_output_sha256',v_output_sha,
           'outcome','draft_requires_human_acceptance'
         )
   where id=t.id;
  update public.curriculum_intelligence_proposals
     set editorial_status='needs_review',editorial_model='source_grounded_authoring_v1:'||i.model_key,updated_at=clock_timestamp()
   where id=p.id;

  return jsonb_build_object(
    'status','completed','authoring_draft_id',v_draft_id,'proposal_id',p.id,
    'editorial_status','needs_review','human_acceptance_required',true
  );
end $$;

create or replace function public.hq_content_authoring_fail(
  p_task_id uuid,p_model_invocation_id uuid,p_error text
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
  if not found then raise exception 'authoring_task_not_found'; end if;
  select * into i from public.hq_workforce_model_invocations where id=p_model_invocation_id for update;
  if found and i.status='authorized' then
    if i.task_id is distinct from t.id then raise exception 'authoring_failure_invocation_mismatch'; end if;
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
    values(t.id,t.worker_key,'CONTENT_AUTHORING_FAILED',left(coalesce(p_error,'unknown_error'),2000),t.attempt_count,t.payload)
    on conflict(task_id) do update set error_detail=excluded.error_detail,attempts=excluded.attempts,
      payload_snapshot=excluded.payload_snapshot,created_at=clock_timestamp();
  end if;
  return jsonb_build_object('status',case when v_exhausted then 'dead_letter' else 'retry_queued' end,'task_id',t.id);
end $$;

-- Human editorial acceptance is deliberately separate from machine drafting. It only prepares
-- the existing editorial patch; proposal approval and apply/publish remain separate HQ actions.
create or replace function public.hq_accept_content_authoring_draft(p_draft_id uuid)
returns public.curriculum_intelligence_proposals
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  d public.curriculum_authoring_drafts%rowtype;
  p public.curriculum_intelligence_proposals%rowtype;
  b public.content_blocks%rowtype;
  v_current_sha text;
  v_impacts jsonb;
begin
  if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
  select * into d from public.curriculum_authoring_drafts where id=p_draft_id;
  if not found then raise exception 'authoring_draft_not_found'; end if;
  select * into p from public.curriculum_intelligence_proposals where id=d.proposal_id for update;
  if not found then raise exception 'authoring_proposal_not_found'; end if;
  if p.status not in ('pending_review','approved') then raise exception 'authoring_acceptance_proposal_status_denied:%',p.status; end if;
  select * into b from public.content_blocks where id=d.target_block_id and chapter_id=d.target_chapter_id for update;
  if not found or b.sequence<>d.target_sequence then raise exception 'authoring_acceptance_target_missing_or_changed'; end if;
  v_current_sha:=encode(extensions.digest(convert_to(coalesce(b.plain_text,''),'UTF8'),'sha256'),'hex');
  if v_current_sha<>d.current_content_sha256 or coalesce(b.plain_text,'')<>d.expected_current then
    raise exception 'authoring_acceptance_target_stale';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'derivative_id',x.id,'type',x.derivative_type,'current_status',x.status,
           'action','invalidate_and_regenerate'
         ) order by x.id),'[]'::jsonb)
    into v_impacts
    from public.content_derivatives x where x.source_chapter_id=d.target_chapter_id;

  update public.curriculum_intelligence_proposals
     set proposed_content=d.draft_content,
         editorial_patch=jsonb_build_object(
           'operation','replace_block_content','sequence',b.sequence,'legacy_block_id',b.legacy_block_id,
           'block_id',b.id,'block_type',b.block_type,'expected_current',coalesce(b.plain_text,''),
           'content',d.draft_content,'source_proposal_id',p.id,'authoring_draft_id',d.id,
           'evidence_packet_sha256',d.evidence_packet_sha256,'citations',d.citations,
           'prepared_from','source_grounded_authoring_v1'
         ),
         editorial_status='prepared',editorial_prepared_at=clock_timestamp(),
         editorial_model=d.model_key,derivative_impacts=v_impacts,updated_at=clock_timestamp()
   where id=p.id returning * into p;

  insert into public.curriculum_intelligence_audit(proposal_id,actor_id,action,before_state,after_state,note)
  values(
    p.id,auth.uid(),'authoring_draft_accepted',
    jsonb_build_object('authoring_draft_id',d.id,'target_block_id',b.id,'current_content_sha256',v_current_sha),
    jsonb_build_object('editorial_status','prepared','evidence_packet_sha256',d.evidence_packet_sha256,'citation_count',jsonb_array_length(d.citations)),
    'HQ owner accepted source-grounded authoring draft; proposal approval/apply remains separate'
  );
  return p;
end $$;

revoke all on function public.hq_content_authoring_claim(uuid,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.hq_content_authoring_complete(uuid,uuid,uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.hq_content_authoring_fail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.hq_content_authoring_claim(uuid,uuid,text,bigint) to service_role;
grant execute on function public.hq_content_authoring_complete(uuid,uuid,uuid,text,text,jsonb,jsonb) to service_role;
grant execute on function public.hq_content_authoring_fail(uuid,uuid,text) to service_role;
revoke all on function public.hq_accept_content_authoring_draft(uuid) from public,anon;
grant execute on function public.hq_accept_content_authoring_draft(uuid) to authenticated;

do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'CF-R2.3 requires Worker Engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CF-R2.3 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'CF-R2.3 cannot install with active capability authority'; end if;
end $$;
