alter table public.curriculum_research_jobs
  add column if not exists seed_urls text[];

comment on column public.curriculum_research_jobs.seed_urls is
'Optional operator- or authority-supplied HTTPS source candidates. Research workers must retrieve the source and semantic verification remains mandatory; a seed URL is never proof by itself.';

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
    from public.hq_workforce_engine_contract where singleton=true;
  if not coalesce(v_runtime_enabled,false) then raise exception 'worker_runtime_global_stop'; end if;
  if coalesce(v_runtime_paused,false) then raise exception 'worker_runtime_anomaly_paused'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'content_research_task_not_found'; end if;
  if t.status <> 'queued' then raise exception 'content_research_task_not_queued:%',t.status; end if;
  if t.next_attempt_at > clock_timestamp() then raise exception 'content_research_task_not_due'; end if;
  if t.payload->>'research_job_id' is distinct from p_job_id::text then raise exception 'content_research_task_job_mismatch'; end if;

  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found or tc.handler_key <> 'content.research.external' then raise exception 'content_research_tool_contract_denied'; end if;
  if t.capability_key <> 'content.research.execute' or t.operation <> 'research' or t.resource_type <> 'curriculum_research_job' then
    raise exception 'content_research_task_semantics_denied';
  end if;

  update public.hq_workforce_task_contracts
     set status='running',attempt_count=attempt_count+1,started_at=coalesce(started_at,clock_timestamp()),
         lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),last_error=null
   where id=t.id;

  v_auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);

  select * into j from public.curriculum_research_jobs where id=p_job_id for update;
  if not found then raise exception 'content_research_job_not_found'; end if;
  if j.status <> 'queued' then raise exception 'content_research_job_not_queued:%',j.status; end if;
  if j.attempt_count >= j.max_attempts then raise exception 'content_research_job_attempts_exhausted'; end if;
  if j.workforce_task_id is not null and j.workforce_task_id <> t.id then raise exception 'content_research_job_already_bound'; end if;

  v_budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  update public.curriculum_research_jobs
     set status='running',claimed_at=clock_timestamp(),claimed_by=t.worker_key,attempt_count=attempt_count+1,
         workforce_task_id=t.id,workforce_budget_reservation_id=v_budget_id,executor_version='content-research-worker-r3.1',
         execution_metadata=coalesce(execution_metadata,'{}'::jsonb)||jsonb_build_object('claimed_at',clock_timestamp(),'task_id',t.id,'worker_key',t.worker_key,'authority',v_auth),
         updated_at=clock_timestamp()
   where id=j.id;

  return jsonb_build_object(
    'decision','allow','task_id',t.id,'job_id',j.id,'proposal_id',j.proposal_id,'worker_key',t.worker_key,
    'research_question',j.research_question,'required_source_count',j.required_source_count,
    'require_primary_source',j.require_primary_source,'allowed_domains',j.allowed_domains,'seed_urls',j.seed_urls,
    'lease_expires_at',(select lease_expires_at from public.hq_workforce_task_contracts where id=t.id),'authorization',v_auth
  );
end $$;

revoke all on function public.hq_content_research_claim(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.hq_content_research_claim(uuid,uuid,integer) to service_role;

create or replace function public.hq_content_factory_r2_operator_attach_canary_seed(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare s public.hq_content_factory_r2_canary_sessions%rowtype;
begin
  if session_user<>'postgres' then raise exception 'gate2_operator_postgres_required'; end if;
  select * into s from public.hq_content_factory_r2_canary_sessions where id=p_session_id for update;
  if not found or s.status<>'prepared' or s.expires_at<=clock_timestamp() then raise exception 'gate2_seed_session_denied'; end if;
  if exists(select 1 from public.curriculum_intelligence_sources where proposal_id=s.proposal_id) then raise exception 'gate2_seed_sources_already_exist'; end if;
  update public.curriculum_intelligence_proposals
     set claim='A gene is a segment of DNA that provides the cell with instructions for making a specific protein.'
   where id=s.proposal_id and status='pending_review';
  if not found then raise exception 'gate2_seed_proposal_denied'; end if;
  update public.curriculum_research_jobs
     set research_question='Verify from an authoritative genomics source that a gene is a segment of DNA that provides the cell with instructions for making a specific protein.',
         required_source_count=1,
         require_primary_source=false,
         allowed_domains=array['genome.gov']::text[],
         seed_urls=array['https://www.genome.gov/About-Genomics/Introduction-to-Genomics']::text[],
         execution_metadata=execution_metadata||jsonb_build_object('trusted_seed_attached_at',clock_timestamp(),'trusted_seed_authority','NHGRI genome.gov','commissioning_gate','Gate-2')
   where id=s.research_job_id and status='queued';
  if not found then raise exception 'gate2_seed_research_job_denied'; end if;
  update public.hq_content_factory_r2_canary_sessions
     set evidence=evidence||jsonb_build_object('trusted_seed_url','https://www.genome.gov/About-Genomics/Introduction-to-Genomics','trusted_seed_attached_at',clock_timestamp())
   where id=s.id;
  return jsonb_build_object('status','prepared','session_id',s.id,'proposal_id',s.proposal_id,'research_job_id',s.research_job_id,'seed_url','https://www.genome.gov/About-Genomics/Introduction-to-Genomics');
end $$;

revoke all on function public.hq_content_factory_r2_operator_attach_canary_seed(uuid) from public,anon,authenticated,service_role;
