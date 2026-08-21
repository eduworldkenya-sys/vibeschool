-- Quality Worker cross-archetype and repair/reverification closure.
-- NON-ACTIVATING: examination only; no target mutation, authority grant or certification mutation.

create or replace function public.hq_workforce_quality_examine_worker(
  p_target_worker_key text,
  p_suite text default 'quality-cross-archetype-v1'
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  q public.hq_workforce_worker_assurance%rowtype;
  a public.hq_workforce_worker_assurance%rowtype;
  v_missing text[]:='{}';
  v_recommendation text;
  v_ids uuid[];
  v_exam uuid;
  v_latest_target_repair timestamptz;
begin
  if p_target_worker_key='quality-worker-01' then raise exception 'quality_self_examination_forbidden'; end if;
  select * into q from public.hq_workforce_worker_assurance
    where worker_key='quality-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  if not found or coalesce(q.worker_version,'')='' then raise exception 'quality_professional_baseline_required'; end if;
  select * into a from public.hq_workforce_worker_assurance
    where worker_key=p_target_worker_key and standard_key='vibeschool-professional-worker' and standard_version=1;
  if not found or coalesce(a.worker_version,'')='' then raise exception 'target_professional_baseline_required'; end if;

  if a.expires_at is not null and a.expires_at<=clock_timestamp() then v_missing:=array_append(v_missing,'expired_certification'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_target_worker_key and worker_version=a.worker_version and evidence_kind='independent' and passed) then v_missing:=array_append(v_missing,'independent'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_target_worker_key and worker_version=a.worker_version and evidence_kind='adversarial' and passed) then v_missing:=array_append(v_missing,'adversarial'); end if;

  select max(created_at) into v_latest_target_repair
  from public.hq_workforce_qualification_evidence
  where worker_key=p_target_worker_key and worker_version=a.worker_version and evidence_kind='repair' and passed;
  if v_latest_target_repair is not null and not exists(
    select 1 from public.hq_workforce_qualification_evidence
    where worker_key=p_target_worker_key and worker_version=a.worker_version
      and evidence_kind='reverification' and passed and created_at>v_latest_target_repair
  ) then v_missing:=array_append(v_missing,'fresh_reverification'); end if;

  if a.risk_class in ('R1','R2','R3') and not exists(
    select 1
    from public.hq_workforce_qualification_evidence qe
    where qe.worker_key=p_target_worker_key and qe.worker_version=a.worker_version
      and qe.evidence_kind='shadow' and qe.passed
      and (
        (qe.suite_version='professional-server-shadow-v1' and exists(
          select 1 from public.hq_workforce_professional_shadow_runs sr
          where sr.id=(qe.evidence->>'run_id')::uuid
            and sr.worker_key=p_target_worker_key
            and sr.worker_version=a.worker_version
            and sr.passed and not sr.side_effects_applied
            and sr.execution_method='professional_server_shadow_v1'
            and sr.verifier_key=qe.evaluator_key
        ))
        or (p_target_worker_key='content-factory-r2-canary-01' and qe.suite_version='existing-server-shadow-v2')
      )
  ) then v_missing:=array_append(v_missing,'shadow'); end if;

  if a.risk_class in ('R2','R3') and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_target_worker_key and worker_version=a.worker_version and evidence_kind='canary' and passed) then v_missing:=array_append(v_missing,'canary'); end if;
  if a.risk_class='R3' and not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_target_worker_key and worker_version=a.worker_version and evidence_kind='human_authority' and passed) then v_missing:=array_append(v_missing,'human_authority'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_target_worker_key and worker_version=a.worker_version and evidence_kind='global_stop' and passed) then v_missing:=array_append(v_missing,'global_stop'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key=p_target_worker_key and worker_version=a.worker_version and evidence_kind='authority_separation' and passed) then v_missing:=array_append(v_missing,'authority_separation'); end if;

  v_recommendation:=case when coalesce(array_length(v_missing,1),0)=0 then 'CERTIFIED' else 'NEEDS_REPAIR' end;
  select coalesce(array_agg(id order by created_at),'{}') into v_ids
  from public.hq_workforce_qualification_evidence
  where worker_key=p_target_worker_key and worker_version=a.worker_version and passed;

  insert into public.hq_workforce_quality_examinations(
    target_worker_key,target_worker_version,quality_worker_key,quality_worker_version,
    suite_version,evidence_provenance,recommendation,passed
  ) values (
    p_target_worker_key,a.worker_version,'quality-worker-01',q.worker_version,p_suite,
    jsonb_build_object(
      'execution_method','quality_cross_archetype_examiner_v1',
      'target_archetype',a.archetype,
      'target_risk_class',a.risk_class,
      'observed_certification_state',a.certification_state,
      'observed_qualification_state',a.qualification_state,
      'target_latest_repair_at',v_latest_target_repair,
      'missing_evidence',to_jsonb(v_missing),
      'qualification_evidence_ids',to_jsonb(v_ids),
      'side_effects_applied',false,
      'authority_changed',false
    ),
    v_recommendation,true
  ) returning id into v_exam;

  return jsonb_build_object(
    'examination_id',v_exam,'target_worker_key',p_target_worker_key,'target_worker_version',a.worker_version,
    'target_archetype',a.archetype,'recommendation',v_recommendation,'missing_evidence',v_missing,
    'side_effects_applied',false,'authority_changed',false
  );
end $$;
revoke all on function public.hq_workforce_quality_examine_worker(text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_quality_examine_worker(text,text) to service_role;

create or replace function public.hq_workforce_quality_certification_readiness()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  a public.hq_workforce_worker_assurance%rowtype;
  v_missing text[]:='{}';
  v_fixture_total int;
  v_fixture_pass int;
  v_cross_archetypes int;
  v_latest_repair timestamptz;
begin
  select * into a from public.hq_workforce_worker_assurance
    where worker_key='quality-worker-01' and standard_key='vibeschool-professional-worker' and standard_version=1;
  if not found then
    return jsonb_build_object('ready',false,'missing',jsonb_build_array('professional_baseline'),'authority_changed',false);
  end if;

  with latest as (
    select distinct on (fixture_key) fixture_key,passed
    from public.hq_workforce_quality_fixture_results
    where suite_version='quality-adversarial-v1' and evidence->>'execution_method'='quality_fixture_evaluator_v1'
    order by fixture_key,created_at desc,id desc
  ) select count(*),count(*) filter(where passed) into v_fixture_total,v_fixture_pass from latest;
  if v_fixture_total<25 or v_fixture_pass<>v_fixture_total then v_missing:=array_append(v_missing,'defective_worker_laboratory'); end if;

  select max(created_at) into v_latest_repair from public.hq_workforce_qualification_evidence
    where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='repair' and passed;
  if v_latest_repair is null then
    v_missing:=array_append(v_missing,'repair_evidence');
  elsif not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='reverification' and passed and created_at>v_latest_repair) then
    v_missing:=array_append(v_missing,'fresh_reverification');
  end if;

  select count(distinct evidence_provenance->>'target_archetype') into v_cross_archetypes
  from public.hq_workforce_quality_examinations
  where quality_worker_key='quality-worker-01' and quality_worker_version=a.worker_version
    and suite_version='quality-cross-archetype-v1' and passed
    and evidence_provenance->>'execution_method'='quality_cross_archetype_examiner_v1';
  if v_cross_archetypes<4 then v_missing:=array_append(v_missing,'cross_archetype_examination'); end if;

  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='independent' and passed) then v_missing:=array_append(v_missing,'independent'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='adversarial' and passed) then v_missing:=array_append(v_missing,'adversarial'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence qe where qe.worker_key='quality-worker-01' and qe.worker_version=a.worker_version and qe.evidence_kind='shadow' and qe.passed and qe.suite_version='professional-server-shadow-v1' and exists(select 1 from public.hq_workforce_professional_shadow_runs sr where sr.id=(qe.evidence->>'run_id')::uuid and sr.worker_key='quality-worker-01' and sr.worker_version=a.worker_version and sr.passed and not sr.side_effects_applied and sr.execution_method='professional_server_shadow_v1' and sr.verifier_key=qe.evaluator_key)) then v_missing:=array_append(v_missing,'shadow'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='global_stop' and passed) then v_missing:=array_append(v_missing,'global_stop'); end if;
  if not exists(select 1 from public.hq_workforce_qualification_evidence where worker_key='quality-worker-01' and worker_version=a.worker_version and evidence_kind='authority_separation' and passed) then v_missing:=array_append(v_missing,'authority_separation'); end if;

  return jsonb_build_object(
    'ready',coalesce(array_length(v_missing,1),0)=0,'missing',v_missing,
    'fixture_total',v_fixture_total,'fixture_pass',v_fixture_pass,
    'cross_archetypes',v_cross_archetypes,'repair_at',v_latest_repair,
    'fixture_execution_method','quality_fixture_evaluator_v1',
    'cross_archetype_execution_method','quality_cross_archetype_examiner_v1',
    'authority_changed',false
  );
end $$;
revoke all on function public.hq_workforce_quality_certification_readiness() from public,anon,authenticated;
grant execute on function public.hq_workforce_quality_certification_readiness() to service_role;
