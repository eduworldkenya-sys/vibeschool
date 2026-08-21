-- Mission #416: require a concrete run_id before casting professional shadow evidence.
-- This is non-activating and preserves all professional certification gates.
create or replace function public.hq_workforce_decide_professional_certification(
  p_worker_key text,
  p_decider text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  a public.hq_workforce_worker_assurance%rowtype;
  v_latest_repair timestamptz;
  v_ids uuid[];
  v_ok boolean;
  v_need text[]:='{}';
begin
  select * into a from public.hq_workforce_worker_assurance
  where worker_key=p_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1
  for update;
  if not found then raise exception 'professional_baseline_required'; end if;
  if p_decider=p_worker_key or coalesce(trim(p_decider),'')='' or p_decider ilike '%creator%' then
    raise exception 'creator_or_self_certification_forbidden';
  end if;

  select max(created_at) into v_latest_repair
  from public.hq_workforce_qualification_evidence
  where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='repair';

  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='independent' and passed) then v_need:=array_append(v_need,'independent'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='adversarial' and passed) then v_need:=array_append(v_need,'adversarial'); end if;
  if v_latest_repair is not null and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='reverification' and passed and created_at>v_latest_repair) then v_need:=array_append(v_need,'fresh_reverification'); end if;

  if a.risk_class in ('R1','R2','R3') and not exists(
    select 1
    from public.hq_workforce_qualification_evidence qe
    where qe.worker_key=p_worker_key and qe.worker_version=a.worker_version
      and qe.evidence_kind='shadow' and qe.passed
      and (
        (qe.suite_version='professional-server-shadow-v1'
          and qe.evidence ? 'run_id'
          and exists(
            select 1 from public.hq_workforce_professional_shadow_runs sr
            where sr.id=(qe.evidence->>'run_id')::uuid
              and sr.worker_key=p_worker_key
              and sr.worker_version=a.worker_version
              and sr.passed and not sr.side_effects_applied
              and sr.execution_method='professional_server_shadow_v1'
              and sr.verifier_key=qe.evaluator_key
          ))
        or (p_worker_key='content-factory-r2-canary-01' and qe.suite_version='existing-server-shadow-v2')
      )
  ) then v_need:=array_append(v_need,'shadow'); end if;

  if a.risk_class in ('R2','R3') and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='canary' and passed) then v_need:=array_append(v_need,'canary'); end if;
  if a.risk_class='R3' and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='human_authority' and passed) then v_need:=array_append(v_need,'human_authority'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='global_stop' and passed) then v_need:=array_append(v_need,'global_stop'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_worker_key and worker_version=a.worker_version and evidence_kind='authority_separation' and passed) then v_need:=array_append(v_need,'authority_separation'); end if;

  v_ok:=coalesce(array_length(v_need,1),0)=0;
  select coalesce(array_agg(id order by created_at),'{}') into v_ids
  from public.hq_workforce_qualification_evidence
  where worker_key=p_worker_key and worker_version=a.worker_version and passed;

  update public.hq_workforce_worker_assurance
  set certification_state=case when v_ok then 'CERTIFIED' else 'NEEDS_REPAIR' end,
      qualification_state=case when v_ok then 'CERTIFIED' else 'FAILED_QUALIFICATION' end,
      legacy_recertification_required=not v_ok,
      certified_at=case when v_ok then clock_timestamp() else null end,
      expires_at=case when v_ok then clock_timestamp()+interval '30 days' else null end,
      certification_evidence_ids=v_ids
  where id=a.id;

  return jsonb_build_object(
    'worker_key',p_worker_key,'certified',v_ok,'missing_evidence',v_need,
    'authority_changed',false,'evidence_ids',v_ids
  );
end $$;
revoke all on function public.hq_workforce_decide_professional_certification(text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_decide_professional_certification(text,text) to service_role;
