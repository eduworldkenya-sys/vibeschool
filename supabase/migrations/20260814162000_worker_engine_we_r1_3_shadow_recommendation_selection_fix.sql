-- WE-R1.3 recommendation selection correction.
-- Keep the recommendation path non-consequential while selecting a single certified shadow-capable manifest safely.

create or replace function public.hq_workforce_shadow_recommend_candidate(p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  c public.hq_workforce_shadow_candidates%rowtype;
  wi public.hq_work_items%rowtype;
  w public.hq_workforce_workers%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  tr uuid;
  auth_result jsonb;
  auth_decision text;
  auth_reason text;
  proposed jsonb;
  expected jsonb;
  confidence numeric:=0.9000;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if not ec.shadow_enabled or not ec.shadow_scheduler_enabled or ec.shadow_global_stop then raise exception 'shadow_scheduler_global_stop'; end if;
  if ec.shadow_anomaly_paused then return jsonb_build_object('mode','shadow','status','paused','reason','shadow_scheduler_anomaly_paused','consequential_execution',false); end if;
  if ec.runtime_execution_enabled or ec.runtime_autonomy_level>0 then raise exception 'shadow_requires_consequential_runtime_off'; end if;

  select * into c from public.hq_workforce_shadow_candidates where id=p_candidate_id for update;
  if not found then raise exception 'shadow_candidate_not_found'; end if;
  if c.status not in ('candidate','escalated') then
    return jsonb_build_object('mode','shadow','status',c.status,'candidate_id',c.id,'trace_id',c.trace_id,'consequential_execution',false);
  end if;

  select * into wi from public.hq_work_items where id=c.source_work_item_id;
  if not found or wi.status<>'open' then
    update public.hq_workforce_shadow_candidates set status='closed',reasoning_summary='Source work is no longer open.' where id=c.id;
    return jsonb_build_object('mode','shadow','status','closed','reason','source_work_not_open','candidate_id',c.id,'consequential_execution',false);
  end if;

  select * into w from public.hq_workforce_workers
   where department_key=c.lane_key and status='active'
   order by worker_key limit 1;
  if not found then
    update public.hq_workforce_shadow_candidates set status='escalated',reasoning_summary='No active worker is available in the required lane.' where id=c.id;
    insert into public.hq_workforce_shadow_anomalies(anomaly_key,severity,action,details)
    values('worker_selection_missing','warning','escalate',jsonb_build_object('candidate_id',c.id,'lane_key',c.lane_key));
    insert into public.hq_workforce_shadow_resource_usage(resource_kind,window_started_at,amount) values('escalation',date_trunc('hour',clock_timestamp()),1);
    return jsonb_build_object('mode','shadow','status','escalated','reason','worker_selection_missing','candidate_id',c.id,'consequential_execution',false);
  end if;

  select sm0.* into sm
  from public.hq_workforce_skill_manifests sm0
  where sm0.certification_status='certified' and sm0.shadow_capable
    and (sm0.expires_at is null or sm0.expires_at>clock_timestamp())
    and 'platform_internal'=any(sm0.allowed_scope_types)
    and exists(
      select 1 from public.hq_workforce_tool_contracts tc0
       where tc0.id=sm0.tool_contract_id and tc0.status='approved' and tc0.handler_key='work_item.triage_and_own'
    )
  order by sm0.risk_class asc,sm0.version desc limit 1;
  if not found then
    update public.hq_workforce_shadow_candidates set status='escalated',worker_key=w.worker_key,reasoning_summary='No certified shadow-capable skill matches this internal work candidate.' where id=c.id;
    insert into public.hq_workforce_shadow_anomalies(anomaly_key,severity,action,details)
    values('skill_selection_missing','warning','escalate',jsonb_build_object('candidate_id',c.id,'worker_key',w.worker_key));
    insert into public.hq_workforce_shadow_resource_usage(worker_key,resource_kind,window_started_at,amount) values(w.worker_key,'escalation',date_trunc('hour',clock_timestamp()),1);
    return jsonb_build_object('mode','shadow','status','escalated','reason','skill_selection_missing','candidate_id',c.id,'worker_key',w.worker_key,'consequential_execution',false);
  end if;

  insert into public.hq_workforce_shadow_traces(cycle_key,worker_key,lane_key,skill_manifest_id,scope_type,scope_ref,status,confidence)
  values('candidate:'||c.id::text,w.worker_key,c.lane_key,sm.id,'platform_internal',c.scope_ref,'reasoning',confidence)
  returning trace_id into tr;

  update public.hq_workforce_shadow_candidates
     set trace_id=tr,worker_key=w.worker_key,skill_manifest_id=sm.id,status='recommended',confidence=confidence,
         reasoning_summary='Active lane worker and certified shadow-capable skill selected deterministically; recommendation awaits human review.'
   where id=c.id;

  insert into public.hq_workforce_evidence(trace_id,evidence_kind,source_type,source_ref,observed_at,classification,payload)
  values(tr,'fact','hq_work_items',wi.id::text,clock_timestamp(),'internal',jsonb_build_object(
    'department_key',wi.department_key,'work_type',wi.work_type,'priority',wi.priority,'status',wi.status,
    'title',wi.title,'summary',wi.summary,'due_at',wi.due_at,'approval_required',wi.approval_required,'source_type',wi.source_type,'source_id',wi.source_id
  ));

  insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values
    (tr,'observation',1,jsonb_build_object('source','hq_work_items','work_item_id',wi.id,'status',wi.status)),
    (tr,'candidate_job',2,jsonb_build_object('candidate_id',c.id,'fingerprint',c.candidate_fingerprint,'priority',c.priority,'sla_due_at',c.sla_due_at)),
    (tr,'reasoning',3,jsonb_build_object('method','deterministic_shadow_triage','why','Open internal HQ work requires bounded triage; no production mutation is permitted.')),
    (tr,'skill_selection',4,jsonb_build_object('skill_key',sm.skill_key,'version',sm.version,'manifest_id',sm.id,'worker_key',w.worker_key));

  proposed:=jsonb_build_object('action_key','work_item.triage_and_own','work_item_id',wi.id,'worker_key',w.worker_key,'consequential',true,'execute',false);
  expected:=jsonb_build_object('expected_state','internal work triaged and explicitly owned','verification','work item ownership/status would be checked after a future authorized execution');
  insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values
    (tr,'proposed_action',5,proposed),
    (tr,'expected_outcome',6,expected);

  auth_result:=public.hq_workforce_shadow_evaluate_authority(tr,sm.id,least(sm.autonomy_required,2),sm.risk_class,'platform_internal',c.scope_ref);
  auth_decision:=coalesce(auth_result->>'decision','deny');
  auth_reason:=coalesce(auth_result->>'reason','fail_closed');
  insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload)
  values(tr,'authority_result',7,auth_result);

  insert into public.hq_workforce_shadow_decisions(
    trace_id,decision_key,proposed_action,required_authority,hypothetical_authority_result,authority_reason,state
  ) values(
    tr,'WE-SHADOW-'||c.id::text,proposed,
    jsonb_build_object('skill_key',sm.skill_key,'skill_version',sm.version,'autonomy_level',least(sm.autonomy_required,2),'risk_class',sm.risk_class,'scope_type','platform_internal','scope_ref',c.scope_ref),
    case when auth_decision='allow' then 'allow' else 'deny' end,auth_reason,'awaiting_review'
  );

  update public.hq_workforce_shadow_traces
     set status='awaiting_review',predicted_outcome=expected,confidence=confidence
   where trace_id=tr;
  insert into public.hq_workforce_shadow_resource_usage(trace_id,worker_key,resource_kind,window_started_at,amount)
  values(tr,w.worker_key,'recommendation',date_trunc('hour',clock_timestamp()),1);

  return jsonb_build_object(
    'mode','shadow','status','awaiting_review','candidate_id',c.id,'trace_id',tr,'worker_key',w.worker_key,
    'skill_key',sm.skill_key,'skill_version',sm.version,'authority_decision',auth_decision,'authority_reason',auth_reason,
    'consequential_execution',false
  );
end $$;

revoke all on function public.hq_workforce_shadow_recommend_candidate(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_shadow_recommend_candidate(uuid) to service_role;
