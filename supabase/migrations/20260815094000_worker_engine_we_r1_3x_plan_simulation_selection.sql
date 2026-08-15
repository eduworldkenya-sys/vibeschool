-- WE-R1.3X X5b: Shadow-only plan simulation and least-sufficient selection. NON-ACTIVATING.

create or replace function public.hq_workforce_simulate_plan(p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.hq_workforce_plans%rowtype; dag jsonb; miss_caps integer; miss_res integer; max_aut smallint; max_risk smallint; cost numeric; latency bigint; confidence numeric;
begin
 select * into p from public.hq_workforce_plans where id=p_plan_id for update; if not found then raise exception 'plan_not_found'; end if;
 if p.status not in ('draft','invalid') then raise exception 'plan_not_simulatable:%',p.status; end if;
 dag:=public.hq_workforce_validate_plan_dag(p_plan_id);
 if not coalesce((dag->>'valid')::boolean,false) then update public.hq_workforce_plans set status='invalid',updated_at=clock_timestamp() where id=p_plan_id; insert into public.hq_workforce_plan_events(plan_id,event_kind,reason,payload) values(p_plan_id,'dag_validated','Plan DAG rejected.',dag); return jsonb_build_object('status','invalid','dag',dag,'consequential_execution',false); end if;
 select count(*) into miss_caps from public.hq_workforce_plan_steps s where s.plan_id=p_plan_id and not exists(select 1 from public.hq_workforce_plan_step_capabilities c where c.plan_step_id=s.id and c.role='required');
 select count(*) into miss_res from public.hq_workforce_plan_step_capabilities c join public.hq_workforce_plan_steps s on s.id=c.plan_step_id where s.plan_id=p_plan_id and c.role='required' and not exists(select 1 from public.hq_workforce_plan_step_resources r where r.plan_step_id=s.id and r.capability_id=c.capability_id and r.required);
 if miss_caps>0 or miss_res>0 then update public.hq_workforce_plans set status='invalid',updated_at=clock_timestamp() where id=p_plan_id; insert into public.hq_workforce_plan_events(plan_id,event_kind,reason,payload) values(p_plan_id,'blocked','Plan lacks complete capability/resource coverage.',jsonb_build_object('missing_capability_steps',miss_caps,'missing_resources',miss_res)); return jsonb_build_object('status','invalid','reason','incomplete_capability_resource_coverage','missing_capability_steps',miss_caps,'missing_resources',miss_res,'dag',dag,'consequential_execution',false); end if;
 select coalesce(max(required_autonomy),0),coalesce(max(required_risk),0),coalesce(sum(estimated_cost),0),coalesce(sum(estimated_latency_ms),0) into max_aut,max_risk,cost,latency from public.hq_workforce_plan_steps where plan_id=p_plan_id;
 select coalesce(min(coalesce(r.reliability,0)),0) into confidence from public.hq_workforce_plan_step_resources psr join public.hq_workforce_plan_steps s on s.id=psr.plan_step_id join public.hq_workforce_resources r on r.id=psr.resource_id where s.plan_id=p_plan_id and psr.required;
 update public.hq_workforce_plans set status='simulated',expected_success=confidence,required_autonomy=max_aut,required_risk=max_risk,estimated_cost=cost,estimated_latency_ms=latency,evidence_quality=1,reversibility_score=case when max_risk=0 then 1 else greatest(0,1-(max_risk::numeric/5)) end,updated_at=clock_timestamp() where id=p_plan_id;
 insert into public.hq_workforce_plan_events(plan_id,event_kind,reason,payload) values(p_plan_id,'simulation','Shadow-only plan simulation completed.',jsonb_build_object('dag',dag,'expected_success',confidence,'required_autonomy',max_aut,'required_risk',max_risk,'estimated_cost',cost,'estimated_latency_ms',latency,'consequential_execution',false));
 return jsonb_build_object('status','simulated','plan_id',p_plan_id,'dag',dag,'expected_success',confidence,'required_autonomy',max_aut,'required_risk',max_risk,'estimated_cost',cost,'estimated_latency_ms',latency,'consequential_execution',false); end $$;

create or replace function public.hq_workforce_select_least_sufficient_plan(p_objective_id uuid,p_max_autonomy smallint default 0,p_max_risk smallint default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare chosen uuid; candidates jsonb; begin
 if not exists(select 1 from public.hq_workforce_objectives where id=p_objective_id) then raise exception 'objective_not_found'; end if;
 select id into chosen from public.hq_workforce_plans where objective_id=p_objective_id and status='simulated' and required_autonomy<=p_max_autonomy and required_risk<=p_max_risk order by required_autonomy,required_risk,estimated_cost,estimated_latency_ms,expected_success desc nulls last,evidence_quality desc,reversibility_score desc,id limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('plan_id',id,'autonomy',required_autonomy,'risk',required_risk,'cost',estimated_cost,'latency_ms',estimated_latency_ms,'expected_success',expected_success,'evidence_quality',evidence_quality,'reversibility',reversibility_score) order by required_autonomy,required_risk,estimated_cost,estimated_latency_ms,expected_success desc),'[]'::jsonb) into candidates from public.hq_workforce_plans where objective_id=p_objective_id and status='simulated';
 if chosen is null then return jsonb_build_object('status','no_sufficient_plan','objective_id',p_objective_id,'candidates',candidates,'consequential_execution',false); end if;
 update public.hq_workforce_plans set status=case when id=chosen then 'selected' else 'candidate' end,updated_at=clock_timestamp() where objective_id=p_objective_id and status='simulated';
 insert into public.hq_workforce_plan_events(plan_id,event_kind,reason,payload) values(chosen,'selected','Least-sufficient safe plan selected after Shadow simulation.',jsonb_build_object('max_autonomy',p_max_autonomy,'max_risk',p_max_risk,'candidates',candidates));
 return jsonb_build_object('status','selected','objective_id',p_objective_id,'selected_plan_id',chosen,'candidates',candidates,'consequential_execution',false); end $$;

revoke all on function public.hq_workforce_simulate_plan(uuid),public.hq_workforce_select_least_sufficient_plan(uuid,smallint,smallint) from public,anon,authenticated;
grant execute on function public.hq_workforce_simulate_plan(uuid),public.hq_workforce_select_least_sufficient_plan(uuid,smallint,smallint) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin select * into ec from public.hq_workforce_engine_contract where singleton=true; if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then raise exception 'WE-R1.3X X5 simulation violated fail-closed runtime boundary'; end if; end $$;
