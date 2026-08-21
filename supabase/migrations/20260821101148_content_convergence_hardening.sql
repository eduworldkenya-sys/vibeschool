-- Priority 5 hardening: verifier-only finding lifecycle, regression enforcement,
-- bounded leases/heartbeats, and HQ decision/metrics read models.

create or replace function public.content_convergence_transition_finding(
  p_finding_id uuid,
  p_expected_state text,
  p_to_state text,
  p_expected_version_id uuid,
  p_expected_hash text,
  p_execution_id text,
  p_evidence jsonb default '{}'::jsonb
) returns public.content_convergence_findings
language plpgsql security definer set search_path = '' as $$
declare
  v_f public.content_convergence_findings;
  v_run public.content_convergence_runs;
  v_hash text;
  v_allowed boolean := false;
  v_p3 public.content_convergence_evaluations;
begin
  select * into v_f from public.content_convergence_findings where id=p_finding_id for update;
  if not found then raise exception 'FINDING_NOT_FOUND'; end if;
  select * into v_run from public.content_convergence_runs where id=v_f.run_id for update;
  if v_f.state <> p_expected_state then raise exception 'STALE_FINDING_STATE'; end if;
  if v_run.current_version_id <> p_expected_version_id or v_f.current_version_id <> p_expected_version_id then raise exception 'STALE_FINDING_VERSION'; end if;
  select content_hash into v_hash from public.content_convergence_versions where id=p_expected_version_id;
  if v_hash is distinct from p_expected_hash then raise exception 'STALE_FINDING_HASH'; end if;

  v_allowed := case
    when p_expected_state='OPEN' and p_to_state in ('REPAIR_REQUESTED','ESCALATED','SUPERSEDED') then true
    when p_expected_state='REPAIR_REQUESTED' and p_to_state in ('REPAIR_ATTEMPTED','ESCALATED') then true
    when p_expected_state='REPAIR_ATTEMPTED' and p_to_state in ('REVERIFYING','ESCALATED') then true
    when p_expected_state='REVERIFYING' and p_to_state in ('VERIFIED_RESOLVED','STILL_PRESENT','REGRESSED','ESCALATED') then true
    when p_expected_state in ('STILL_PRESENT','REGRESSED') and p_to_state in ('REPAIR_REQUESTED','ESCALATED','SUPERSEDED') then true
    else false end;
  if not v_allowed then raise exception 'ILLEGAL_FINDING_TRANSITION:%->%',p_expected_state,p_to_state; end if;

  if p_to_state='REPAIR_ATTEMPTED' then
    if v_f.repair_attempts >= v_run.max_attempts then raise exception 'FINDING_REPAIR_ATTEMPT_LIMIT_REACHED'; end if;
    update public.content_convergence_findings set repair_attempts=repair_attempts+1,last_repair_execution_id=p_execution_id where id=p_finding_id returning * into v_f;
  end if;

  if p_to_state='VERIFIED_RESOLVED' then
    select * into v_p3 from public.content_convergence_evaluations
      where run_id=v_f.run_id and version_id=p_expected_version_id and stage='P3'
        and content_hash=p_expected_hash and worker_execution_id=p_execution_id and disposition='PASS'
      order by created_at desc limit 1;
    if v_p3.id is null then raise exception 'INDEPENDENT_P3_VERIFICATION_REQUIRED'; end if;
    if v_f.last_repair_execution_id is not null and v_f.last_repair_execution_id=p_execution_id then raise exception 'REPAIR_WORKER_CANNOT_SELF_VERIFY'; end if;
    update public.content_convergence_findings set verified_by_execution_id=p_execution_id where id=p_finding_id;
  end if;

  update public.content_convergence_findings
    set state=p_to_state,current_version_id=p_expected_version_id,evidence=coalesce(evidence,'{}'::jsonb)||coalesce(p_evidence,'{}'::jsonb),updated_at=now()
    where id=p_finding_id returning * into v_f;
  return v_f;
end $$;

create or replace function public.content_convergence_record_delta(
  p_run_id uuid,
  p_from_version_id uuid,
  p_to_version_id uuid,
  p_to_hash text,
  p_resolved jsonb,
  p_remaining jsonb,
  p_new jsonb,
  p_regressions jsonb,
  p_improved jsonb,
  p_worsened jsonb,
  p_unchanged jsonb,
  p_measurable_improvement boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_run public.content_convergence_runs;
  v_to public.content_convergence_versions;
  v_zero boolean := false;
  v_id uuid;
begin
  select * into v_run from public.content_convergence_runs where id=p_run_id for update;
  if not found then raise exception 'CONVERGENCE_RUN_NOT_FOUND'; end if;
  if v_run.current_version_id <> p_to_version_id then raise exception 'STALE_DELTA_VERSION'; end if;
  select * into v_to from public.content_convergence_versions where id=p_to_version_id;
  if v_to.parent_version_id is distinct from p_from_version_id then raise exception 'INVALID_DELTA_LINEAGE'; end if;
  if v_to.content_hash is distinct from p_to_hash then raise exception 'STALE_DELTA_HASH'; end if;

  select exists (
    select 1 from jsonb_array_elements(coalesce(p_regressions,'[]'::jsonb)) x
    where lower(coalesce(x->>'dimension',x->>'defect_type','')) in
      ('scientific_correctness','learner_safety','curriculum_identity','assessment_correctness','fabricated_evidence','provenance','authorization')
       or upper(coalesce(x->>'severity',''))='CRITICAL'
  ) into v_zero;

  insert into public.content_convergence_deltas(run_id,from_version_id,to_version_id,resolved_findings,remaining_findings,new_findings,regressions,improved_dimensions,worsened_dimensions,unchanged_dimensions,severe_regression,measurable_improvement)
  values(p_run_id,p_from_version_id,p_to_version_id,coalesce(p_resolved,'[]'::jsonb),coalesce(p_remaining,'[]'::jsonb),coalesce(p_new,'[]'::jsonb),coalesce(p_regressions,'[]'::jsonb),coalesce(p_improved,'{}'::jsonb),coalesce(p_worsened,'{}'::jsonb),coalesce(p_unchanged,'{}'::jsonb),v_zero,coalesce(p_measurable_improvement,false))
  on conflict(run_id,from_version_id,to_version_id) do update set resolved_findings=excluded.resolved_findings,remaining_findings=excluded.remaining_findings,new_findings=excluded.new_findings,regressions=excluded.regressions,improved_dimensions=excluded.improved_dimensions,worsened_dimensions=excluded.worsened_dimensions,unchanged_dimensions=excluded.unchanged_dimensions,severe_regression=excluded.severe_regression,measurable_improvement=excluded.measurable_improvement,created_at=now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.content_convergence_claim_lease(
  p_run_id uuid,p_expected_version_id uuid,p_expected_hash text,p_owner text,p_ttl_seconds integer default 300
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_run public.content_convergence_runs; v_hash text; v_exp timestamptz;
begin
  if p_ttl_seconds not between 60 and 900 then raise exception 'INVALID_LEASE_TTL'; end if;
  select * into v_run from public.content_convergence_runs where id=p_run_id for update;
  if not found then raise exception 'CONVERGENCE_RUN_NOT_FOUND'; end if;
  if v_run.current_version_id <> p_expected_version_id then raise exception 'STALE_LEASE_VERSION'; end if;
  select content_hash into v_hash from public.content_convergence_versions where id=p_expected_version_id;
  if v_hash is distinct from p_expected_hash then raise exception 'STALE_LEASE_HASH'; end if;
  if v_run.lease_expires_at is not null and v_run.lease_expires_at>now() and v_run.lease_owner is distinct from p_owner then raise exception 'CONVERGENCE_LEASE_HELD'; end if;
  if v_run.state in ('REPAIRING','REVERIFYING') and exists(select 1 from public.hq_workforce_engine_contract where singleton=true and (shadow_global_stop=true or runtime_execution_enabled<>true)) then raise exception 'WORKER_ENGINE_GLOBAL_STOP_OR_RUNTIME_OFF'; end if;
  v_exp:=now()+make_interval(secs=>p_ttl_seconds);
  update public.content_convergence_runs set lease_owner=p_owner,lease_expires_at=v_exp,last_heartbeat_at=now(),updated_at=now() where id=p_run_id;
  return v_exp;
end $$;

create or replace function public.content_convergence_heartbeat(
  p_run_id uuid,p_expected_version_id uuid,p_expected_hash text,p_owner text,p_ttl_seconds integer default 300
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_run public.content_convergence_runs; v_hash text; v_exp timestamptz;
begin
  if p_ttl_seconds not between 60 and 900 then raise exception 'INVALID_LEASE_TTL'; end if;
  select * into v_run from public.content_convergence_runs where id=p_run_id for update;
  if not found then raise exception 'CONVERGENCE_RUN_NOT_FOUND'; end if;
  if v_run.current_version_id<>p_expected_version_id then raise exception 'STALE_HEARTBEAT_VERSION'; end if;
  select content_hash into v_hash from public.content_convergence_versions where id=p_expected_version_id;
  if v_hash is distinct from p_expected_hash then raise exception 'STALE_HEARTBEAT_HASH'; end if;
  if v_run.lease_owner is distinct from p_owner or v_run.lease_expires_at is null or v_run.lease_expires_at<=now() then raise exception 'LEASE_NOT_OWNED_OR_EXPIRED'; end if;
  if v_run.state in ('REPAIRING','REVERIFYING') and exists(select 1 from public.hq_workforce_engine_contract where singleton=true and (shadow_global_stop=true or runtime_execution_enabled<>true)) then raise exception 'WORKER_ENGINE_GLOBAL_STOP_OR_RUNTIME_OFF'; end if;
  v_exp:=now()+make_interval(secs=>p_ttl_seconds);
  update public.content_convergence_runs set lease_expires_at=v_exp,last_heartbeat_at=now(),updated_at=now() where id=p_run_id;
  return v_exp;
end $$;

create or replace function public.hq_content_convergence_decision_packet(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public.hq_assert_owner();
  select jsonb_build_object(
    'run_id',r.id,'publication_id',r.publication_id,'publication_title',p.title,'state',r.state,'mode',r.mode,
    'attempt_count',r.attempt_count,'max_attempts',r.max_attempts,'failure_code',r.failure_code,'decision_reason',r.decision_reason,'next_action',r.next_action,
    'version',jsonb_build_object('id',v0.id,'number',v0.version_number,'hash',v0.content_hash,'parent_version_id',v0.parent_version_id,'curriculum_identity',v0.curriculum_identity,'provenance',v0.provenance),
    'open_findings',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'key',f.finding_key,'severity',f.severity,'type',f.defect_type,'state',f.state,'repair_attempts',f.repair_attempts) order by case f.severity when 'CRITICAL' then 0 when 'HIGH' then 1 when 'MEDIUM' then 2 else 3 end,f.created_at),'[]'::jsonb) from public.content_convergence_findings f where f.run_id=r.id and f.state not in ('VERIFIED_RESOLVED','SUPERSEDED')),
    'latest_p2',(select to_jsonb(e)-'findings'-'dimensions' from public.content_convergence_evaluations e where e.run_id=r.id and e.version_id=r.current_version_id and e.stage='P2' order by e.created_at desc limit 1),
    'latest_p3',(select to_jsonb(e)-'findings'-'dimensions' from public.content_convergence_evaluations e where e.run_id=r.id and e.version_id=r.current_version_id and e.stage='P3' order by e.created_at desc limit 1),
    'latest_delta',(select to_jsonb(d) from public.content_convergence_deltas d where d.run_id=r.id and d.to_version_id=r.current_version_id order by d.created_at desc limit 1),
    'release_decision',(select to_jsonb(rd) from public.content_convergence_release_decisions rd where rd.run_id=r.id and rd.version_id=r.current_version_id order by rd.created_at desc limit 1),
    'history',(select coalesce(jsonb_agg(jsonb_build_object('from',ev.from_state,'to',ev.to_state,'actor',ev.actor,'execution_id',ev.execution_id,'version_id',ev.artifact_version_id,'hash',ev.artifact_hash,'reason',ev.reason,'at',ev.created_at) order by ev.id),'[]'::jsonb) from public.content_convergence_events ev where ev.run_id=r.id)
  ) into v
  from public.content_convergence_runs r join public.content_convergence_versions v0 on v0.id=r.current_version_id join public.vibe_publications p on p.id=r.publication_id
  where r.id=p_run_id;
  if v is null then raise exception 'CONVERGENCE_RUN_NOT_FOUND'; end if;
  return v;
end $$;

create or replace function public.hq_content_convergence_metrics(p_since timestamptz default now()-interval '30 days')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public.hq_assert_owner();
  select jsonb_build_object(
    'since',p_since,'runs',count(*),
    'first_pass_convergence',count(*) filter(where state in ('CONVERGED','RELEASE_CANDIDATE') and attempt_count=0),
    'one_repair_convergence',count(*) filter(where state in ('CONVERGED','RELEASE_CANDIDATE') and attempt_count=1),
    'multi_repair_convergence',count(*) filter(where state in ('CONVERGED','RELEASE_CANDIDATE') and attempt_count>1),
    'escalated',count(*) filter(where state='ESCALATED'),
    'escalation_rate',case when count(*)=0 then 0 else round((count(*) filter(where state='ESCALATED'))::numeric/count(*)::numeric,4) end,
    'critical_regression_runs',(select count(distinct d.run_id) from public.content_convergence_deltas d join public.content_convergence_runs rr on rr.id=d.run_id where d.severe_regression and rr.created_at>=p_since),
    'verified_repairs',(select count(*) from public.content_convergence_findings f join public.content_convergence_runs rr on rr.id=f.run_id where f.state='VERIFIED_RESOLVED' and f.last_repair_execution_id is not null and rr.created_at>=p_since),
    'average_attempts_for_verified_resolution',(select coalesce(round(avg(f.repair_attempts)::numeric,2),0) from public.content_convergence_findings f join public.content_convergence_runs rr on rr.id=f.run_id where f.state='VERIFIED_RESOLVED' and f.last_repair_execution_id is not null and rr.created_at>=p_since),
    'release_candidates',(select count(*) from public.content_convergence_release_decisions rd join public.content_convergence_runs rr on rr.id=rd.run_id where rd.decision='RELEASE_CANDIDATE' and rr.created_at>=p_since)
  ) into v from public.content_convergence_runs where created_at>=p_since;
  return v;
end $$;

revoke all on function public.content_convergence_transition_finding(uuid,text,text,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.content_convergence_record_delta(uuid,uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.content_convergence_claim_lease(uuid,uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.content_convergence_heartbeat(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.content_convergence_transition_finding(uuid,text,text,uuid,text,text,jsonb) to service_role;
grant execute on function public.content_convergence_record_delta(uuid,uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean) to service_role;
grant execute on function public.content_convergence_claim_lease(uuid,uuid,text,text,integer) to service_role;
grant execute on function public.content_convergence_heartbeat(uuid,uuid,text,text,integer) to service_role;

revoke all on function public.hq_content_convergence_decision_packet(uuid) from public,anon;
revoke all on function public.hq_content_convergence_metrics(timestamptz) from public,anon;
grant execute on function public.hq_content_convergence_decision_packet(uuid) to authenticated,service_role;
grant execute on function public.hq_content_convergence_metrics(timestamptz) to authenticated,service_role;
