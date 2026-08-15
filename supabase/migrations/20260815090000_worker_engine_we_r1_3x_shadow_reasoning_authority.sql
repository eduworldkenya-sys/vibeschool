-- WE-R1.3X authority reconciliation: reasoning authority is not execution authority.
-- Shadow reasoning capabilities have no ToolContract by design. They are evaluated against
-- the actual plan-step worker, certified competency binding, registered resources, L0 and
-- human-review requirements. Existing execution authority evaluation remains unchanged.
-- This migration never enables heartbeat, Factory, runtime execution or autonomy.

create or replace function public.hq_workforce_shadow_evaluate_step_authority(
  p_trace_id uuid,
  p_plan_step_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  tr public.hq_workforce_shadow_traces%rowtype;
  st public.hq_workforce_plan_steps%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_decision text:='deny';
  v_reason text:='fail_closed';
  v_missing_competency integer:=0;
  v_unsafe_required_resource integer:=0;
  v_safe_resources integer:=0;
begin
  select * into tr from public.hq_workforce_shadow_traces where trace_id=p_trace_id;
  if not found then raise exception 'shadow_trace_not_found'; end if;
  select * into st from public.hq_workforce_plan_steps where id=p_plan_step_id;
  if not found then raise exception 'plan_step_not_found'; end if;
  select * into sm from public.hq_workforce_skill_manifests where id=st.skill_manifest_id;
  if not found then raise exception 'skill_manifest_not_found'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;

  select count(*) into v_missing_competency
  from unnest(st.required_competencies) req(competency_key)
  where not exists (
    select 1
    from public.hq_workforce_worker_competencies c
    join public.hq_workforce_competency_capabilities b
      on b.competency_key=c.competency_key
     and b.skill_key=sm.skill_key
     and b.status='approved'
    where c.worker_key=st.worker_key
      and c.competency_key=req.competency_key
      and c.certification_status='certified'
      and (c.expires_at is null or c.expires_at>clock_timestamp())
      and (tr.scope_type=any(c.allowed_scope_types) or 'global'=any(c.allowed_scope_types))
  );

  select count(*) into v_unsafe_required_resource
  from public.hq_workforce_skill_resources sr
  join public.hq_workforce_resources r on r.id=sr.resource_id
  where sr.skill_manifest_id=sm.id
    and sr.required
    and not (
      r.enabled and r.shadow_capable
      and r.health_status in ('healthy','degraded')
      and r.required_autonomy=0 and r.risk_class<=2
      and sr.operation=any(r.allowed_operations)
      and (tr.scope_type=any(r.allowed_scope_types) or 'global'=any(r.allowed_scope_types))
    );

  select count(*) into v_safe_resources
  from public.hq_workforce_resolve_step_resources(st.id,'read',100);

  if not ec.shadow_enabled or ec.shadow_global_stop or ec.shadow_anomaly_paused then
    v_reason:='shadow_not_available';
  elsif ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.heartbeat_enabled or ec.factory_enabled then
    v_reason:='r13x_requires_l0_runtime_off';
  elsif st.worker_key is null then
    v_reason:='plan_step_worker_missing';
  elsif not exists(select 1 from public.hq_workforce_workers w where w.worker_key=st.worker_key and w.status='active') then
    v_reason:='worker_not_active';
  elsif public.hq_workforce_current_lifecycle_state(st.worker_key)<>'active' then
    v_reason:='worker_lifecycle_not_active';
  elsif sm.capability_mode<>'shadow_reasoning' then
    v_reason:='not_shadow_reasoning_capability';
  elsif sm.tool_contract_id is not null then
    v_reason:='shadow_reasoning_has_execution_tool';
  elsif sm.certification_status<>'certified' then
    v_reason:='skill_uncertified';
  elsif not sm.shadow_capable or sm.autonomy_required<>0 then
    v_reason:='skill_not_l0_shadow';
  elsif not sm.requires_human_approval or not sm.verification_required then
    v_reason:='human_review_or_verification_missing';
  elsif sm.expires_at is not null and sm.expires_at<=clock_timestamp() then
    v_reason:='skill_expired';
  elsif st.required_autonomy<>0 then
    v_reason:='step_autonomy_above_l0';
  elsif st.required_risk>sm.risk_class then
    v_reason:='step_risk_above_skill_ceiling';
  elsif not (tr.scope_type=any(sm.allowed_scope_types) or 'global'=any(sm.allowed_scope_types)) then
    v_reason:='skill_scope_denied';
  elsif cardinality(st.required_competencies)=0 then
    v_reason:='step_competency_contract_missing';
  elsif v_missing_competency<>0 then
    v_reason:='worker_competency_not_certified_for_capability';
  elsif v_unsafe_required_resource<>0 then
    v_reason:='required_resource_not_shadow_safe';
  elsif v_safe_resources=0 then
    v_reason:='no_shadow_safe_registered_resource';
  else
    v_decision:='allow';
    v_reason:='hypothetical_shadow_reasoning_allow';
  end if;

  insert into public.hq_workforce_runtime_authorization_events(
    worker_key,skill_key,decision,reason_code,autonomy_level,risk_class,scope_type,scope_ref
  ) values(
    coalesce(st.worker_key,'unknown'),sm.skill_key,
    case when v_decision='allow' then 'allow' else 'deny' end,
    'shadow_reasoning:'||v_reason,st.required_autonomy,st.required_risk,
    tr.scope_type,tr.scope_ref
  );

  return jsonb_build_object(
    'mode','shadow_reasoning','decision',v_decision,'reason',v_reason,
    'worker_key',st.worker_key,'step_key',st.step_key,'skill_key',sm.skill_key,
    'tool_contract_required',false,'execution_identity_required',false,
    'safe_resource_count',v_safe_resources,'consequential_execution',false
  );
end $$;

revoke all on function public.hq_workforce_shadow_evaluate_step_authority(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_shadow_evaluate_step_authority(uuid,uuid) to service_role;

-- Replace only the R1.3X composed recommendation wrapper so each plan step is checked
-- against its own assigned worker. The legacy execution evaluator remains intact.
create or replace function public.hq_workforce_shadow_recommend_candidate(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 ec public.hq_workforce_engine_contract%rowtype; c public.hq_workforce_shadow_candidates%rowtype; wi public.hq_work_items%rowtype; req text[]; obj uuid; built jsonb; plan uuid;
 primary_worker text; first_skill uuid; tr uuid; proposed jsonb; expected jsonb; auth_payload jsonb:='[]'::jsonb; auth_result jsonb; overall text:='allow'; overall_reason text:='all_plan_steps_hypothetically_allowed';
 r record; risk smallint:=0; v_confidence numeric:=0.85; total_resources int:=0;
begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true; if not found then raise exception 'runtime_contract_missing'; end if;
 if not ec.shadow_enabled or not ec.shadow_scheduler_enabled or ec.shadow_global_stop then raise exception 'shadow_scheduler_global_stop'; end if;
 if ec.shadow_anomaly_paused then return jsonb_build_object('mode','shadow','status','paused','reason','shadow_scheduler_anomaly_paused','consequential_execution',false); end if;
 if ec.runtime_execution_enabled or ec.runtime_autonomy_level>0 or ec.heartbeat_enabled or ec.factory_enabled then raise exception 'r13x_requires_runtime_factory_heartbeat_off'; end if;
 select * into c from public.hq_workforce_shadow_candidates where id=p_candidate_id for update; if not found then raise exception 'shadow_candidate_not_found'; end if;
 if c.status not in ('candidate','escalated') then return jsonb_build_object('mode','shadow','status',c.status,'candidate_id',c.id,'trace_id',c.trace_id,'consequential_execution',false); end if;
 select * into wi from public.hq_work_items where id=c.source_work_item_id; if not found or wi.status<>'open' then update public.hq_workforce_shadow_candidates set status='closed',reasoning_summary='Source work is no longer open.' where id=c.id; return jsonb_build_object('mode','shadow','status','closed','reason','source_work_not_open','consequential_execution',false); end if;
 req:=public.hq_workforce_required_competencies_for_work(wi.id);
 insert into public.hq_workforce_objectives(objective_key,statement,scope_type,scope_key,jurisdiction,required_competencies,desired_outcome,constraints,risk_ceiling,autonomy_ceiling,status,source_type,source_ref,provenance,evidence_requirements)
 values('shadow-candidate:'||c.id::text,coalesce(wi.title,'Operational work'),'platform_internal',wi.id::text,'global',req,jsonb_build_object('work_item_id',wi.id,'target','evidence-backed recommendation'),jsonb_build_object('consequential_execution',false),2,0,'planning','hq_work_item',wi.id::text,jsonb_build_object('mode','production_shadow','candidate_id',c.id,'work_item_id',wi.id),'[{"kind":"verification","required":true}]'::jsonb) returning id into obj;
 built:=public.hq_workforce_build_shadow_plan(obj);
 if built->>'status'<>'simulated' then update public.hq_workforce_shadow_candidates set status='escalated',reasoning_summary='R1.3X composition could not cover the complete objective.' where id=c.id; return jsonb_build_object('mode','shadow','architecture','WE-R1.3X','status','escalated','candidate_id',c.id,'objective_id',obj,'plan',built,'consequential_execution',false); end if;
 plan:=(built->>'plan_id')::uuid; primary_worker:=built->>'primary_worker'; v_confidence:=coalesce((built->>'confidence')::numeric,.85); risk:=coalesce((built->>'max_risk')::smallint,0); total_resources:=coalesce((built->>'resource_bindings')::int,0);
 select skill_manifest_id into first_skill from public.hq_workforce_plan_steps where plan_id=plan order by ordinal limit 1;
 insert into public.hq_workforce_shadow_traces(cycle_key,worker_key,lane_key,skill_manifest_id,scope_type,scope_ref,status,confidence)
 values('r13x-objective:'||obj::text,primary_worker,c.lane_key,first_skill,'platform_internal',c.scope_ref,'reasoning',v_confidence) returning trace_id into tr;
 insert into public.hq_workforce_evidence(trace_id,evidence_kind,source_type,source_ref,observed_at,classification,payload)
 values(tr,'fact','hq_work_items',wi.id::text,clock_timestamp(),'internal',jsonb_build_object('work_item',to_jsonb(wi),'objective_id',obj,'plan_id',plan,'required_competencies',req,'composition',built));
 insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values
 (tr,'observation',1,jsonb_build_object('work_item_id',wi.id)),(tr,'candidate_job',2,jsonb_build_object('candidate_id',c.id)),
 (tr,'reasoning',3,jsonb_build_object('architecture','WE-R1.3X','objective_id',obj,'plan_id',plan,'required_competencies',req,'composition',built)),
 (tr,'skill_selection',4,jsonb_build_object('steps',(select jsonb_agg(jsonb_build_object('ordinal',s.ordinal,'worker_key',s.worker_key,'skill_manifest_id',s.skill_manifest_id,'competencies',s.required_competencies) order by s.ordinal) from public.hq_workforce_plan_steps s where s.plan_id=plan)));
 proposed:=jsonb_build_object('action_key','recommend_composed_operational_plan','work_item_id',wi.id,'objective_id',obj,'plan_id',plan,'workers',built->'workers','execute',false);
 expected:=jsonb_build_object('expected_state','human-reviewed evidence-backed composed recommendation','verification','human decision and measured outcome');
 insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values(tr,'proposed_action',5,proposed),(tr,'expected_outcome',6,expected);
 for r in select s.*,m.risk_class as skill_risk from public.hq_workforce_plan_steps s join public.hq_workforce_skill_manifests m on m.id=s.skill_manifest_id where s.plan_id=plan order by s.ordinal loop
   auth_result:=public.hq_workforce_shadow_evaluate_step_authority(tr,r.id);
   auth_payload:=auth_payload||jsonb_build_array(jsonb_build_object('step_key',r.step_key,'worker_key',r.worker_key,'result',auth_result));
   if auth_result->>'decision'<>'allow' then overall:='deny'; overall_reason:=coalesce(auth_result->>'reason','plan_step_denied'); end if;
 end loop;
 insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values(tr,'authority_result',7,jsonb_build_object('decision',overall,'reason',overall_reason,'steps',auth_payload));
 insert into public.hq_workforce_shadow_decisions(trace_id,decision_key,proposed_action,required_authority,hypothetical_authority_result,authority_reason,state)
 values(tr,'WE-R13X-'||c.id::text,proposed,jsonb_build_object('autonomy_level',0,'risk_class',risk,'scope_type','platform_internal'),overall,overall_reason,'awaiting_review');
 update public.hq_workforce_shadow_traces set status='awaiting_review',predicted_outcome=expected,confidence=v_confidence where trace_id=tr;
 update public.hq_workforce_shadow_candidates set trace_id=tr,worker_key=primary_worker,skill_manifest_id=first_skill,status='recommended',confidence=v_confidence,reasoning_summary='R1.3X full-coverage routing: objective → competencies → workers/collaboration → capabilities → resources → step-specific hypothetical authority.' where id=c.id;
 insert into public.hq_workforce_shadow_resource_usage(trace_id,worker_key,resource_kind,window_started_at,amount) values(tr,primary_worker,'recommendation',date_trunc('hour',clock_timestamp()),1);
 return jsonb_build_object('mode','shadow','architecture','WE-R1.3X','status','awaiting_review','candidate_id',c.id,'trace_id',tr,'objective_id',obj,'plan_id',plan,'worker_key',primary_worker,'workers',built->'workers','required_competencies',req,'resource_count',total_resources,'authority',jsonb_build_object('decision',overall,'reason',overall_reason,'steps',auth_payload),'authority_decision',overall,'authority_reason',overall_reason,'consequential_execution',false);
end $$;

revoke all on function public.hq_workforce_shadow_recommend_candidate(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_shadow_recommend_candidate(uuid) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then
   raise exception 'shadow_reasoning_authority_violated_L0_boundary';
 end if;
 if exists(select 1 from public.hq_workforce_skill_manifests where capability_mode='shadow_reasoning' and tool_contract_id is not null) then
   raise exception 'shadow_reasoning_execution_tool_regression';
 end if;
end $$;
