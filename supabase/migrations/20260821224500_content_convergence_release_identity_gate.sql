-- Forward repair: release eligibility must consume governed evaluator identity.
-- No runtime, publishing, scheduler, payment, or authority activation.

create or replace function public.content_convergence_release_gate(p_run_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
  v_run public.content_convergence_runs; v_version public.content_convergence_versions;
  v_p2 public.content_convergence_evaluations; v_p3 public.content_convergence_evaluations;
  v_p2i public.content_convergence_evaluation_identities; v_p3i public.content_convergence_evaluation_identities;
  v_critical integer; v_severe_regression boolean; v_identity_current boolean;
  v_decision text; v_reason text;
begin
  select * into v_run from public.content_convergence_runs where id=p_run_id for update;
  if not found then raise exception 'CONVERGENCE_RUN_NOT_FOUND'; end if;
  select * into v_version from public.content_convergence_versions where id=v_run.current_version_id;
  select * into v_p2 from public.content_convergence_evaluations where run_id=p_run_id and version_id=v_version.id and stage='P2' order by created_at desc limit 1;
  select * into v_p3 from public.content_convergence_evaluations where run_id=p_run_id and version_id=v_version.id and stage='P3' order by created_at desc limit 1;
  if v_p2.id is not null then select * into v_p2i from public.content_convergence_evaluation_identities where evaluation_id=v_p2.id; end if;
  if v_p3.id is not null then select * into v_p3i from public.content_convergence_evaluation_identities where evaluation_id=v_p3.id; end if;
  select count(*) into v_critical from public.content_convergence_findings where run_id=p_run_id and severity='CRITICAL' and state not in ('VERIFIED_RESOLVED','SUPERSEDED');
  select coalesce(bool_or(severe_regression),false) into v_severe_regression from public.content_convergence_deltas where run_id=p_run_id and to_version_id=v_version.id;
  select
    exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=v_version.worker_key and a.worker_version=v_p2i.author_worker_version and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp())
    and exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=v_p2i.evaluator_worker_key and a.worker_version=v_p2i.evaluator_worker_version and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp())
    and exists(select 1 from public.hq_workforce_worker_assurance a where a.worker_key=v_p3i.evaluator_worker_key and a.worker_version=v_p3i.evaluator_worker_version and a.certification_state='CERTIFIED' and a.qualification_state='CERTIFIED' and not a.legacy_recertification_required and a.expires_at>clock_timestamp())
  into v_identity_current;

  if v_run.state<>'CONVERGED' then v_decision:='NOT_READY'; v_reason:='run has not converged';
  elsif v_p2.id is null or v_p3.id is null then v_decision:='NOT_READY'; v_reason:='fresh P2 and P3 evidence is required for exact version';
  elsif v_p2i.evaluation_id is null or v_p3i.evaluation_id is null then v_decision:='NOT_READY'; v_reason:='governed evaluator identity is required for P2 and P3';
  elsif v_p2i.author_worker_key<>v_version.worker_key or v_p3i.author_worker_key<>v_version.worker_key then v_decision:='NOT_READY'; v_reason:='evaluation author lineage does not match release version';
  elsif v_p2i.evaluator_worker_key=v_p3i.evaluator_worker_key then v_decision:='NOT_READY'; v_reason:='P2 quality and P3 critic identities must be distinct';
  elsif not coalesce(v_identity_current,false) then v_decision:='NOT_READY'; v_reason:='author or evaluator certification is stale, expired, or changed';
  elsif v_p2.content_hash<>v_version.content_hash or v_p3.content_hash<>v_version.content_hash then v_decision:='NOT_READY'; v_reason:='evaluation hash does not match release version';
  elsif v_p2.disposition<>'PASS' or v_p3.disposition<>'PASS' then v_decision:='NOT_READY'; v_reason:='latest independent evaluation is not PASS';
  elsif v_critical>0 then v_decision:='NOT_READY'; v_reason:='unresolved critical finding';
  elsif v_severe_regression then v_decision:='NOT_READY'; v_reason:='zero-tolerance regression detected';
  elsif upper(v_p2.safety_status)<>'PASS' or upper(v_p3.safety_status)<>'PASS' then v_decision:='NOT_READY'; v_reason:='safety status is not PASS';
  elsif upper(v_p2.assessment_status)<>'PASS' or upper(v_p3.assessment_status)<>'PASS' then v_decision:='NOT_READY'; v_reason:='assessment integrity is not PASS';
  elsif upper(v_p2.provenance_status)<>'PASS' or upper(v_p3.provenance_status)<>'PASS' then v_decision:='HUMAN_REVIEW_REQUIRED'; v_reason:='provenance requires human authority';
  elsif exists(select 1 from public.hq_workforce_engine_contract where singleton=true and (shadow_global_stop or not runtime_execution_enabled)) then v_decision:='NOT_READY'; v_reason:='Worker Engine Global Stop or runtime-off blocks release-candidate generation';
  else v_decision:='RELEASE_CANDIDATE'; v_reason:='converged exact version has fresh independent governed evidence'; end if;

  insert into public.content_convergence_release_decisions(run_id,version_id,content_hash,decision,reason,evidence_packet)
  values(p_run_id,v_version.id,v_version.content_hash,v_decision,v_reason,jsonb_build_object(
    'publication_id',v_run.publication_id,'version_id',v_version.id,'content_hash',v_version.content_hash,
    'p2_evaluation_id',v_p2.id,'p3_evaluation_id',v_p3.id,'p2_identity',to_jsonb(v_p2i),'p3_identity',to_jsonb(v_p3i),
    'attempt_count',v_run.attempt_count,'critical_open',v_critical,'severe_regression',v_severe_regression,
    'identity_current',coalesce(v_identity_current,false),'human_publication_approval_required',true))
  on conflict(run_id,version_id,content_hash) do update set decision=excluded.decision,reason=excluded.reason,evidence_packet=excluded.evidence_packet,created_at=now();
  return v_decision;
end $$;

revoke all on function public.content_convergence_release_gate(uuid) from public,anon,authenticated;
grant execute on function public.content_convergence_release_gate(uuid) to service_role;
