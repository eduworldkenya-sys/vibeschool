-- Content Factory R2.1.1: research evidence trust hardening.
-- NON-ACTIVATING.
-- Legacy curriculum-intelligence ingestion marked search results supports_claim=true without
-- recording a semantic verification method. Such rows are candidate evidence, not verified
-- evidence, and must never satisfy the release evidence gate.

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
         count(*) filter(
           where (source_tier=1 or source_type in ('official','primary_research','government'))
             and verification_method in ('manual_verified','certified_semantic_verifier_v1')
         ),
         count(*) filter(
           where supports_claim is true
             and not contradicts_claim
             and verification_method in ('manual_verified','certified_semantic_verifier_v1')
         ),
         count(*) filter(
           where supports_claim is null
              or verification_method is null
              or verification_method not in ('manual_verified','certified_semantic_verifier_v1')
         ),
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
           'semantic_support_required',true,
           'trusted_verification_methods',jsonb_build_array('manual_verified','certified_semantic_verifier_v1')
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
    'contradictions',contradict_n,
    'trusted_verification_methods',jsonb_build_array('manual_verified','certified_semantic_verifier_v1')
  );
end $$;

revoke all on function public.finalize_research_job(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_research_job(uuid,jsonb) to service_role;

-- Do not rewrite legacy evidence flags in this migration. Keeping the historical source rows
-- intact preserves auditability; the trust gate above simply refuses to treat those flags as
-- certified semantic evidence.

do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'CF-R2.1.1 requires Worker Engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CF-R2.1.1 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'CF-R2.1.1 cannot install with active capability authority'; end if;
end $$;
