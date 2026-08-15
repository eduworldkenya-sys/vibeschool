-- WE-R1.3X composition planner: full competency coverage, multi-capability planning and cross-worker collaboration.
-- access: service-only public.hq_workforce_competency_capabilities
-- authorization-test: public.hq_workforce_competency_capabilities denies anon/authenticated direct access; service_role manages certified competency-to-capability policy.

create table public.hq_workforce_competency_capabilities (
 id uuid primary key default gen_random_uuid(),
 competency_key text not null,
 skill_key text not null,
 version integer not null default 1 check(version>0),
 min_skill_version integer not null default 1 check(min_skill_version>0),
 required boolean not null default true,
 priority integer not null default 100 check(priority>=0),
 status text not null default 'draft' check(status in ('draft','approved','superseded','revoked')),
 approved_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 unique(competency_key,skill_key,version),
 check(status<>'approved' or approved_at is not null)
);
create index hq_workforce_competency_capabilities_lookup_idx on public.hq_workforce_competency_capabilities(competency_key,status,priority desc);

create or replace function public.hq_workforce_resolve_capability_for_competency(
 p_competency_key text,p_scope_type text,p_jurisdiction text default 'global'
) returns table(skill_manifest_id uuid,skill_key text,skill_version integer,risk_class smallint,worker_independent boolean)
language sql security definer set search_path=public,pg_temp stable as $$
 select m.id,m.skill_key,m.version,m.risk_class,true
 from public.hq_workforce_competency_capabilities b
 join public.hq_workforce_skill_manifests m on m.skill_key=b.skill_key and m.version>=b.min_skill_version
 where b.competency_key=p_competency_key and b.status='approved'
   and m.certification_status='certified' and m.shadow_capable and m.autonomy_required=0
   and (m.expires_at is null or m.expires_at>clock_timestamp())
   and (p_scope_type=any(m.allowed_scope_types) or 'global'=any(m.allowed_scope_types))
   and exists(
     select 1 from public.hq_workforce_skill_resources sr
     join public.hq_workforce_resources r on r.id=sr.resource_id
     where sr.skill_manifest_id=m.id and r.enabled and r.shadow_capable
       and r.health_status in ('healthy','degraded') and r.required_autonomy=0 and r.risk_class<=2
       and (p_scope_type=any(r.allowed_scope_types) or 'global'=any(r.allowed_scope_types))
       and (p_jurisdiction=any(r.jurisdictions) or 'global'=any(r.jurisdictions))
   )
 order by b.priority desc,m.risk_class asc,m.version desc limit 1;
$$;

create or replace function public.hq_workforce_build_shadow_plan(p_objective_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 o public.hq_workforce_objectives%rowtype; comp text; ord int:=0; v_worker text; cap record; v_plan uuid; v_step uuid; v_prev uuid;
 v_primary text; v_workers text[]:=array[]::text[]; v_missing text[]:=array[]::text[]; v_resources int; v_total_resources int:=0;
 v_max_risk smallint:=0; v_dag jsonb; v_conf numeric:=1; v_fit numeric; v_collabs int:=0;
begin
 select * into o from public.hq_workforce_objectives where id=p_objective_id for update; if not found then raise exception 'objective_not_found'; end if;
 if cardinality(o.required_competencies)=0 then return jsonb_build_object('status','escalated','reason','objective_has_no_competency_contract','objective_id',o.id); end if;
 insert into public.hq_workforce_plans(objective_id,strategy_key,status,expected_quality,confidence,required_risk,required_autonomy,estimated_cost,estimated_latency_ms,rationale,verification_contract)
 values(o.id,'composed-certified-shadow','draft',0.85,0.85,0,0,0,0,jsonb_build_object('architecture','WE-R1.3X','composition','one certified capability per required competency'),jsonb_build_object('evidence_required',true,'human_decision',true)) returning id into v_plan;

 foreach comp in array o.required_competencies loop
  ord:=ord+1; v_worker:=null; v_fit:=null;
  select rw.worker_key,rw.fit_score into v_worker,v_fit
  from public.hq_workforce_rank_workers_by_competency(array[comp],o.scope_type,o.jurisdiction,100) rw
  join public.hq_workforce_workers w on w.worker_key=rw.worker_key and w.status='active'
  where public.hq_workforce_current_lifecycle_state(rw.worker_key)='active'
  order by rw.fit_score desc,rw.worker_key limit 1;
  select * into cap from public.hq_workforce_resolve_capability_for_competency(comp,o.scope_type,o.jurisdiction);
  if v_worker is null or not found then
    v_missing:=array_append(v_missing,comp||case when v_worker is null then ':worker' else ':capability' end);
    continue;
  end if;
  if v_primary is null then v_primary:=v_worker; end if;
  if not (v_worker=any(v_workers)) then v_workers:=array_append(v_workers,v_worker); end if;
  v_max_risk:=greatest(v_max_risk,cap.risk_class);
  v_conf:=least(v_conf,coalesce(v_fit,0));
  insert into public.hq_workforce_plan_steps(plan_id,step_key,ordinal,skill_manifest_id,worker_key,required_competencies,input_contract,expected_output,verification_contract,required_risk,required_autonomy)
  values(v_plan,'capability-'||ord::text,ord,cap.skill_manifest_id,v_worker,array[comp],jsonb_build_object('objective_id',o.id,'competency',comp),jsonb_build_object('competency_result',comp),jsonb_build_object('evidence_required',true),cap.risk_class,0) returning id into v_step;
  select count(*) into v_resources from public.hq_workforce_resolve_step_resources(v_step,'read',25); v_total_resources:=v_total_resources+v_resources;
  if v_resources=0 then v_missing:=array_append(v_missing,comp||':resource'); end if;
  if v_prev is not null then insert into public.hq_workforce_plan_step_dependencies(plan_id,step_id,depends_on_step_id,dependency_type) values(v_plan,v_step,v_prev,'evidence_from'); end if;
  v_prev:=v_step;
 end loop;

 if cardinality(v_missing)>0 then
   update public.hq_workforce_plans set status='rejected',rationale=rationale||jsonb_build_object('missing',v_missing) where id=v_plan;
   update public.hq_workforce_objectives set status='escalated',updated_at=clock_timestamp() where id=o.id;
   perform public.hq_workforce_propose_skill_candidate(jsonb_build_object('objective_id',o.id,'missing',v_missing),jsonb_build_object('purpose',o.statement,'required_competencies',o.required_competencies,'autonomy_ceiling',0),'[]','[]');
   return jsonb_build_object('status','escalated','reason','incomplete_competency_capability_coverage','objective_id',o.id,'plan_id',v_plan,'missing',v_missing,'factory',public.hq_workforce_diagnose_capability_gap(o.id));
 end if;

 -- Collaboration is explicit whenever more than one worker contributes. Authority is snapshot-only and never transferred.
 if cardinality(v_workers)>1 then
   foreach v_worker in array v_workers loop
     if v_worker<>v_primary then
       insert into public.hq_workforce_collaborations(trace_id,plan_id,from_worker_key,to_worker_key,collaboration_type,requested_competencies,authority_snapshot,status)
       values(o.trace_id,v_plan,v_primary,v_worker,'consult',o.required_competencies,jsonb_build_object('autonomy',0,'risk',v_max_risk,'authority_transfer',false),'proposed');
       v_collabs:=v_collabs+1;
     end if;
   end loop;
 end if;
 v_dag:=public.hq_workforce_validate_plan_dag(v_plan);
 if not coalesce((v_dag->>'valid')::boolean,false) then update public.hq_workforce_plans set status='rejected' where id=v_plan; update public.hq_workforce_objectives set status='escalated',updated_at=clock_timestamp() where id=o.id; return jsonb_build_object('status','escalated','reason','composed_plan_invalid','plan_id',v_plan,'dag',v_dag); end if;
 update public.hq_workforce_plans set status='simulated',confidence=v_conf,required_risk=v_max_risk,rationale=rationale||jsonb_build_object('workers',v_workers,'resource_bindings',v_total_resources,'collaborations',v_collabs) where id=v_plan;
 update public.hq_workforce_objectives set status='planned',updated_at=clock_timestamp() where id=o.id;
 return jsonb_build_object('status','simulated','objective_id',o.id,'plan_id',v_plan,'primary_worker',v_primary,'workers',v_workers,'competency_count',cardinality(o.required_competencies),'resource_bindings',v_total_resources,'collaborations',v_collabs,'confidence',v_conf,'max_risk',v_max_risk,'dag',v_dag);
end $$;

-- Canonical recommendation now consumes a fully composed plan rather than choosing one arbitrary skill.
create or replace function public.hq_workforce_shadow_recommend_candidate(p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 ec public.hq_workforce_engine_contract%rowtype; c public.hq_workforce_shadow_candidates%rowtype; wi public.hq_work_items%rowtype; req text[]; obj uuid; built jsonb; plan uuid;
 primary_worker text; first_skill uuid; tr uuid; proposed jsonb; expected jsonb; auth_payload jsonb:='[]'::jsonb; auth_result jsonb; overall text:='allow'; overall_reason text:='all_plan_steps_hypothetically_allowed';
 r record; seq int:=0; risk smallint:=0; confidence numeric:=0.85; total_resources int:=0;
begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true; if not found then raise exception 'runtime_contract_missing'; end if;
 if not ec.shadow_enabled or not ec.shadow_scheduler_enabled or ec.shadow_global_stop then raise exception 'shadow_scheduler_global_stop'; end if;
 if ec.shadow_anomaly_paused then return jsonb_build_object('mode','shadow','status','paused','reason','shadow_scheduler_anomaly_paused','consequential_execution',false); end if;
 if ec.runtime_execution_enabled or ec.runtime_autonomy_level>0 or ec.heartbeat_enabled or ec.factory_enabled then raise exception 'r13x_requires_runtime_factory_heartbeat_off'; end if;
 select * into c from public.hq_workforce_shadow_candidates where id=p_candidate_id for update; if not found then raise exception 'shadow_candidate_not_found'; end if;
 if c.status not in ('candidate','escalated') then return jsonb_build_object('mode','shadow','status',c.status,'candidate_id',c.id,'trace_id',c.trace_id,'consequential_execution',false); end if;
 select * into wi from public.hq_work_items where id=c.source_work_item_id; if not found or wi.status<>'open' then update public.hq_workforce_shadow_candidates set status='closed',reasoning_summary='Source work is no longer open.' where id=c.id; return jsonb_build_object('mode','shadow','status','closed','reason','source_work_not_open','consequential_execution',false); end if;
 req:=public.hq_workforce_required_competencies_for_work(wi.id);
 insert into public.hq_workforce_objectives(objective_key,statement,scope_type,scope_key,jurisdiction,required_competencies,desired_outcome,constraints,risk_ceiling,autonomy_ceiling,status)
 values('shadow-candidate:'||c.id::text,coalesce(wi.title,'Operational work'),'platform_internal',wi.id::text,'global',req,jsonb_build_object('work_item_id',wi.id,'target','evidence-backed recommendation'),jsonb_build_object('consequential_execution',false),2,0,'planning') returning id into obj;
 built:=public.hq_workforce_build_shadow_plan(obj);
 if built->>'status'<>'simulated' then update public.hq_workforce_shadow_candidates set status='escalated',reasoning_summary='R1.3X composition could not cover the complete objective.' where id=c.id; return jsonb_build_object('mode','shadow','architecture','WE-R1.3X','status','escalated','candidate_id',c.id,'objective_id',obj,'plan',built,'consequential_execution',false); end if;
 plan:=(built->>'plan_id')::uuid; primary_worker:=built->>'primary_worker'; confidence:=coalesce((built->>'confidence')::numeric,.85); risk:=coalesce((built->>'max_risk')::smallint,0); total_resources:=coalesce((built->>'resource_bindings')::int,0);
 select skill_manifest_id into first_skill from public.hq_workforce_plan_steps where plan_id=plan order by ordinal limit 1;
 insert into public.hq_workforce_shadow_traces(cycle_key,worker_key,lane_key,skill_manifest_id,scope_type,scope_ref,status,confidence)
 values('r13x-objective:'||obj::text,primary_worker,c.lane_key,first_skill,'platform_internal',c.scope_ref,'reasoning',confidence) returning trace_id into tr;
 update public.hq_workforce_shadow_candidates set trace_id=tr,worker_key=primary_worker,skill_manifest_id=first_skill,status='recommended',confidence=confidence,reasoning_summary='R1.3X full-coverage routing: objective → competencies → workers/collaboration → capabilities → resources → validated plan.' where id=c.id;
 insert into public.hq_workforce_evidence(trace_id,evidence_kind,source_type,source_ref,observed_at,classification,payload)
 values(tr,'fact','hq_work_items',wi.id::text,clock_timestamp(),'internal',jsonb_build_object('work_item',to_jsonb(wi),'objective_id',obj,'plan_id',plan,'required_competencies',req,'composition',built));
 insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values
 (tr,'observation',1,jsonb_build_object('work_item_id',wi.id)),
 (tr,'candidate_job',2,jsonb_build_object('candidate_id',c.id)),
 (tr,'reasoning',3,jsonb_build_object('architecture','WE-R1.3X','objective_id',obj,'plan_id',plan,'required_competencies',req,'composition',built)),
 (tr,'skill_selection',4,jsonb_build_object('steps',(select jsonb_agg(jsonb_build_object('ordinal',s.ordinal,'worker_key',s.worker_key,'skill_manifest_id',s.skill_manifest_id,'competencies',s.required_competencies) order by s.ordinal) from public.hq_workforce_plan_steps s where s.plan_id=plan)));
 proposed:=jsonb_build_object('action_key','recommend_composed_operational_plan','work_item_id',wi.id,'objective_id',obj,'plan_id',plan,'workers',built->'workers','execute',false);
 expected:=jsonb_build_object('expected_state','human-reviewed evidence-backed composed recommendation','verification','human decision and measured outcome');
 insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values(tr,'proposed_action',5,proposed),(tr,'expected_outcome',6,expected);
 for r in select s.*,m.risk_class as skill_risk from public.hq_workforce_plan_steps s join public.hq_workforce_skill_manifests m on m.id=s.skill_manifest_id where s.plan_id=plan order by s.ordinal loop
   auth_result:=public.hq_workforce_shadow_evaluate_authority(tr,r.skill_manifest_id,0::smallint,r.skill_risk::smallint,'platform_internal',c.scope_ref);
   auth_payload:=auth_payload||jsonb_build_array(jsonb_build_object('step_key',r.step_key,'worker_key',r.worker_key,'result',auth_result));
   if auth_result->>'decision'<>'allow' then overall:='deny'; overall_reason:=coalesce(auth_result->>'reason','plan_step_denied'); end if;
 end loop;
 insert into public.hq_workforce_shadow_events(trace_id,event_kind,sequence_no,payload) values(tr,'authority_result',7,jsonb_build_object('decision',overall,'reason',overall_reason,'steps',auth_payload));
 insert into public.hq_workforce_shadow_decisions(trace_id,decision_key,proposed_action,required_authority,hypothetical_authority_result,authority_reason,state)
 values(tr,'WE-R13X-'||c.id::text,proposed,jsonb_build_object('autonomy_level',0,'risk_class',risk,'scope_type','platform_internal'),overall,overall_reason,'awaiting_review');
 update public.hq_workforce_shadow_traces set status='awaiting_review',predicted_outcome=expected,confidence=confidence where trace_id=tr;
 insert into public.hq_workforce_shadow_resource_usage(trace_id,worker_key,resource_kind,window_started_at,amount) values(tr,primary_worker,'recommendation',date_trunc('hour',clock_timestamp()),1);
 return jsonb_build_object('mode','shadow','architecture','WE-R1.3X','status','awaiting_review','candidate_id',c.id,'trace_id',tr,'objective_id',obj,'plan_id',plan,'worker_key',primary_worker,'workers',built->'workers','required_competencies',req,'resource_count',total_resources,'authority',jsonb_build_object('decision',overall,'reason',overall_reason,'steps',auth_payload),'authority_decision',overall,'authority_reason',overall_reason,'consequential_execution',false);
end $$;

alter table public.hq_workforce_competency_capabilities enable row level security;
revoke all on public.hq_workforce_competency_capabilities from public,anon,authenticated;
grant select,insert,update on public.hq_workforce_competency_capabilities to service_role;
revoke all on function public.hq_workforce_resolve_capability_for_competency(text,text,text),public.hq_workforce_build_shadow_plan(uuid),public.hq_workforce_shadow_recommend_candidate(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_resolve_capability_for_competency(text,text,text),public.hq_workforce_build_shadow_plan(uuid),public.hq_workforce_shadow_recommend_candidate(uuid) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin select * into ec from public.hq_workforce_engine_contract where singleton=true; if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'composition_planner_violated_L0_boundary'; end if; end $$;
