-- WE-R1.3X X7: Scheduler Reconciliation. NON-ACTIVATING.
-- Canonical scheduler operates on Objective -> Context -> Plan -> Resource -> Route -> Shadow, never raw work-item scanning.
-- access: service-only public.hq_workforce_scheduler_events
-- authorization-test: public.hq_workforce_scheduler_events denies anon/authenticated direct access; append-only scheduler evidence.

do $$
begin
  if to_regclass('cron.job') is not null then
    execute 'select cron.unschedule(jobid) from cron.job where jobname=$1' using 'vibeschool-worker-engine-heartbeat';
  end if;
end $$;

update public.hq_workforce_engine_contract
set heartbeat_enabled=false,factory_enabled=false,runtime_execution_enabled=false,
    runtime_autonomy_level=0,runtime_max_risk=0,shadow_enabled=false,
    shadow_scheduler_enabled=false,shadow_global_stop=true,updated_at=clock_timestamp()
where singleton=true;

create or replace function public.hq_workforce_scheduled_heartbeat()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return jsonb_build_object('status','retired','mode','compatibility_tombstone',
    'reason','legacy_heartbeat_scheduler_superseded_by_governed_shadow_scheduler','consequential_execution',false);
end $$;

create or replace function public.hq_workforce_legacy_heartbeat_cron_present()
returns boolean language plpgsql security definer set search_path=public,pg_temp stable as $$
declare v boolean:=false;
begin
  if to_regclass('cron.job') is null then return false; end if;
  execute 'select exists(select 1 from cron.job where jobname=$1)' into v using 'vibeschool-worker-engine-heartbeat';
  return coalesce(v,false);
end $$;

revoke all on function public.hq_workforce_scheduled_heartbeat() from public,anon,authenticated;
revoke all on function public.hq_workforce_legacy_heartbeat_cron_present() from public,anon,authenticated;
grant execute on function public.hq_workforce_scheduled_heartbeat() to service_role;
grant execute on function public.hq_workforce_legacy_heartbeat_cron_present() to service_role;

create table if not exists public.hq_workforce_scheduler_events (
  id bigint generated always as identity primary key,
  cycle_key text not null,
  objective_id uuid references public.hq_workforce_objectives(id) on delete restrict,
  plan_id uuid references public.hq_workforce_plans(id) on delete restrict,
  plan_step_id uuid references public.hq_workforce_plan_steps(id) on delete restrict,
  stage text not null check(stage in ('sense','objective','context','planning','resolve','route','shadow','blocked','complete')),
  outcome text not null,
  details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
  consequential_execution boolean not null default false check(consequential_execution=false),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_scheduler_events_cycle_idx on public.hq_workforce_scheduler_events(cycle_key,created_at,id);
create index if not exists hq_workforce_scheduler_events_objective_idx on public.hq_workforce_scheduler_events(objective_id,created_at,id) where objective_id is not null;

create or replace function public.hq_workforce_scheduler_events_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$ begin raise exception 'worker_engine_scheduler_evidence_is_append_only'; end $$;
drop trigger if exists trg_hq_workforce_scheduler_events_immutable on public.hq_workforce_scheduler_events;
create trigger trg_hq_workforce_scheduler_events_immutable before update or delete on public.hq_workforce_scheduler_events
for each row execute function public.hq_workforce_scheduler_events_immutable();

create or replace function public.hq_workforce_run_r1_3x_shadow_scheduler(p_cycle_key text,p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  o public.hq_workforce_objectives%rowtype;
  p public.hq_workforce_plans%rowtype;
  s public.hq_workforce_plan_steps%rowtype;
  cap record;
  res jsonb; sim jsonb; sel jsonb; route jsonb;
  selected_plan uuid; resolution_event bigint;
  processed integer:=0; ready_count integer:=0; blocked_count integer:=0; routed_steps integer:=0;
  active_depth integer; cycles_this_hour integer; window_start timestamptz:=date_trunc('hour',clock_timestamp());
  critical_context_count integer; invalid_critical_context_count integer;
begin
  if char_length(btrim(coalesce(p_cycle_key,''))) not between 3 and 200 then raise exception 'r1_3x_scheduler_cycle_key_invalid'; end if;
  if p_limit<1 or p_limit>100 then raise exception 'r1_3x_scheduler_limit_invalid'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('vibeschool.worker_engine.r1_3x.scheduler',0)) then raise exception 'r1_3x_scheduler_concurrency_ceiling'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then
    raise exception 'r1_3x_scheduler_requires_heartbeat_factory_execution_off_l0_r0';
  end if;
  if not ec.shadow_enabled or not ec.shadow_scheduler_enabled or ec.shadow_global_stop then
    return jsonb_build_object('status','disabled','reason','shadow_scheduler_global_stop','cycle_key',p_cycle_key,'consequential_execution',false);
  end if;
  if ec.shadow_anomaly_paused then raise exception 'shadow_scheduler_anomaly_paused'; end if;
  if public.hq_workforce_legacy_heartbeat_cron_present() then raise exception 'r1_3x_scheduler_legacy_cron_bypass_detected'; end if;

  select count(*) into cycles_this_hour from public.hq_workforce_shadow_resource_usage where resource_kind='cycle' and window_started_at=window_start;
  if cycles_this_hour>=ec.shadow_max_cycles_per_hour then
    insert into public.hq_workforce_shadow_anomalies(anomaly_key,severity,action,details)
    values('r1_3x_cycle_rate_ceiling','high','pause',jsonb_build_object('cycle_key',p_cycle_key,'count',cycles_this_hour,'ceiling',ec.shadow_max_cycles_per_hour));
    update public.hq_workforce_engine_contract set shadow_anomaly_paused=true,updated_at=clock_timestamp() where singleton=true;
    return jsonb_build_object('status','paused','reason','cycle_rate_ceiling','cycle_key',p_cycle_key,'consequential_execution',false);
  end if;

  select count(*) into active_depth from public.hq_workforce_objectives where status in ('detected','context_pending','planning','shadow_ready');
  if active_depth>ec.shadow_max_queue_depth then
    insert into public.hq_workforce_shadow_anomalies(anomaly_key,severity,action,details)
    values('r1_3x_objective_queue_depth_ceiling','critical','pause',jsonb_build_object('depth',active_depth,'ceiling',ec.shadow_max_queue_depth));
    update public.hq_workforce_engine_contract set shadow_anomaly_paused=true,updated_at=clock_timestamp() where singleton=true;
    return jsonb_build_object('status','paused','reason','objective_queue_depth_ceiling','cycle_key',p_cycle_key,'consequential_execution',false);
  end if;

  insert into public.hq_workforce_shadow_resource_usage(resource_kind,window_started_at,amount) values('cycle',window_start,1);
  insert into public.hq_workforce_scheduler_events(cycle_key,stage,outcome,details)
  values(p_cycle_key,'sense','objective_queue_observed',jsonb_build_object('active_objectives',active_depth,'source','first_class_objectives_not_open_work_items'));

  for o in
    select * from public.hq_workforce_objectives where status in ('detected','context_pending','planning')
    order by priority desc,coalesce(sla_due_at,'infinity'::timestamptz),created_at
    limit least(p_limit,ec.shadow_max_candidates_per_cycle) for update skip locked
  loop
    processed:=processed+1;
    if o.status='detected' then
      perform public.hq_workforce_transition_objective(o.id,'context_pending','X7 scheduler accepted detected objective into governed context stage.','system','r1_3x_scheduler','[]'::jsonb);
      insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,stage,outcome,details)
      values(p_cycle_key,o.id,'objective','context_requested',jsonb_build_object('source_type',o.source_type,'source_ref',o.source_ref));
      continue;
    end if;

    if o.status='context_pending' then
      select count(*) into critical_context_count
      from public.hq_workforce_objective_context oc
      where oc.objective_id=o.id and oc.context_role in ('required','constraint','policy','risk');

      select count(*) into invalid_critical_context_count
      from public.hq_workforce_objective_context oc
      join public.hq_workforce_memory_records m on m.id=oc.memory_id
      where oc.objective_id=o.id and oc.context_role in ('required','constraint','policy','risk')
        and (
          m.verification_state in ('revoked','superseded','disputed')
          or (m.valid_until is not null and m.valid_until<=clock_timestamp())
          or (oc.required_freshness_seconds is not null and coalesce(m.observed_at,m.created_at)<clock_timestamp()-make_interval(secs=>oc.required_freshness_seconds::double precision))
        );

      if critical_context_count=0 or invalid_critical_context_count>0 then
        insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,stage,outcome,details)
        values(
          p_cycle_key,o.id,'context','awaiting_governed_context',
          jsonb_build_object(
            'policy','all_bound_critical_context_must_be_current_and_usable',
            'critical_context_count',critical_context_count,
            'invalid_critical_context_count',invalid_critical_context_count
          )
        );
        continue;
      end if;

      perform public.hq_workforce_transition_objective(o.id,'planning','X7 scheduler verified all bound critical context is usable and advanced objective to planning.','system','r1_3x_scheduler','[]'::jsonb);
      insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,stage,outcome,details)
      values(
        p_cycle_key,o.id,'context','usable_context_verified',
        jsonb_build_object('critical_context_count',critical_context_count,'invalid_critical_context_count',invalid_critical_context_count)
      );
      o.status:='planning';
    end if;

    if o.status='planning' then
      insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,stage,outcome,details)
      values(p_cycle_key,o.id,'planning','candidate_plans_loaded',jsonb_build_object('scheduler_creates_plans',false));

      for p in select * from public.hq_workforce_plans where objective_id=o.id and status='draft' order by version,created_at loop
        for cap in
          select distinct ps.id plan_step_id,psc.capability_id,cr.access_mode
          from public.hq_workforce_plan_steps ps
          join public.hq_workforce_plan_step_capabilities psc on psc.plan_step_id=ps.id and psc.role='required'
          join public.hq_workforce_capability_resources cr on cr.capability_id=psc.capability_id and cr.required
          where ps.plan_id=p.id and not exists(
            select 1 from public.hq_workforce_plan_step_resources pr
            where pr.plan_step_id=ps.id and pr.capability_id=psc.capability_id and pr.access_mode=cr.access_mode and pr.required)
        loop
          res:=public.hq_workforce_resolve_resource(
            cap.capability_id,o.scope_type,'global','internal',cap.access_mode,
            0::smallint,0::smallint,true,o.id
          );
          if res->>'status'='selected' then
            select id into resolution_event from public.hq_workforce_resource_resolution_events
            where objective_id=o.id and capability_id=cap.capability_id and selected_resource_id=(res->>'selected_resource_id')::uuid order by id desc limit 1;
            insert into public.hq_workforce_plan_step_resources(plan_step_id,capability_id,resource_id,access_mode,resolution_event_id,required)
            values(cap.plan_step_id,cap.capability_id,(res->>'selected_resource_id')::uuid,cap.access_mode,resolution_event,true) on conflict do nothing;
            insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,plan_id,plan_step_id,stage,outcome,details)
            values(p_cycle_key,o.id,p.id,cap.plan_step_id,'resolve','resource_selected',jsonb_build_object('capability_id',cap.capability_id,'resource_id',res->>'selected_resource_id','access_mode',cap.access_mode));
          else
            insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,plan_id,plan_step_id,stage,outcome,details)
            values(p_cycle_key,o.id,p.id,cap.plan_step_id,'resolve','resource_unresolved',jsonb_build_object('capability_id',cap.capability_id,'resolver',res));
          end if;
        end loop;
        sim:=public.hq_workforce_simulate_plan(p.id);
        insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,plan_id,stage,outcome,details)
        values(p_cycle_key,o.id,p.id,'shadow',coalesce(sim->>'status','unknown'),jsonb_build_object('simulation',sim));
      end loop;

      sel:=public.hq_workforce_select_least_sufficient_plan(o.id,0::smallint,0::smallint);
      if sel->>'status'<>'selected' then
        perform public.hq_workforce_transition_objective(o.id,'blocked','X7 scheduler found no least-sufficient L0/R0 plan.','system','r1_3x_scheduler','[]'::jsonb);
        insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,stage,outcome,details)
        values(p_cycle_key,o.id,'blocked','no_sufficient_plan',jsonb_build_object('selection',sel));
        blocked_count:=blocked_count+1; continue;
      end if;

      selected_plan:=(sel->>'selected_plan_id')::uuid;
      for s in select * from public.hq_workforce_plan_steps where plan_id=selected_plan order by ordinal loop
        route:=public.hq_workforce_route_plan_step(s.id,null,null);
        insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,plan_id,plan_step_id,stage,outcome,details)
        values(p_cycle_key,o.id,selected_plan,s.id,'route',coalesce(route->>'status','unknown'),jsonb_build_object('routing',route,'department_is_hard_gate',false));
        if route->>'status' in ('single_worker','team') then routed_steps:=routed_steps+1; end if;
      end loop;

      if exists(select 1 from public.hq_workforce_plan_steps where plan_id=selected_plan and status<>'resolvable') then
        perform public.hq_workforce_transition_objective(o.id,'blocked','X7 scheduler could not resolve every selected plan step under competency/authority constraints.','system','r1_3x_scheduler','[]'::jsonb);
        insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,plan_id,stage,outcome) values(p_cycle_key,o.id,selected_plan,'blocked','routing_incomplete');
        blocked_count:=blocked_count+1;
      else
        perform public.hq_workforce_transition_objective(o.id,'shadow_ready','X7 scheduler completed context, resource, simulation, selection and competency routing at L0/R0.','system','r1_3x_scheduler','[]'::jsonb);
        insert into public.hq_workforce_scheduler_events(cycle_key,objective_id,plan_id,stage,outcome,details)
        values(p_cycle_key,o.id,selected_plan,'shadow','objective_shadow_ready',jsonb_build_object('consequential_execution',false));
        ready_count:=ready_count+1;
      end if;
    end if;
  end loop;

  insert into public.hq_workforce_scheduler_events(cycle_key,stage,outcome,details)
  values(p_cycle_key,'complete','cycle_complete',jsonb_build_object('processed',processed,'shadow_ready',ready_count,'blocked',blocked_count,'routed_steps',routed_steps));
  return jsonb_build_object('status','completed','mode','r1_3x_objective_first_shadow','cycle_key',p_cycle_key,'processed',processed,
    'shadow_ready',ready_count,'blocked',blocked_count,'routed_steps',routed_steps,'pipeline',jsonb_build_array('sense','objective','context','planning','resolve','route','shadow'),'consequential_execution',false);
end $$;

-- Historical API remains callable for compatibility, but it is now a fail-closed adapter.
create or replace function public.hq_workforce_run_shadow_cycle(p_cycle_key text,p_limit integer default 25)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if not ec.shadow_enabled or not ec.shadow_scheduler_enabled or ec.shadow_global_stop then
    return jsonb_build_object('status','disabled','reason','shadow_scheduler_global_stop','cycle_key',p_cycle_key,'consequential_execution',false);
  end if;
  return public.hq_workforce_run_r1_3x_shadow_scheduler(p_cycle_key,p_limit);
end $$;

alter table public.hq_workforce_scheduler_events enable row level security;
revoke all on table public.hq_workforce_scheduler_events from public,anon,authenticated;
grant select,insert on table public.hq_workforce_scheduler_events to service_role;
revoke all on sequence public.hq_workforce_scheduler_events_id_seq from public,anon,authenticated;
grant usage,select on sequence public.hq_workforce_scheduler_events_id_seq to service_role;
revoke all on function public.hq_workforce_run_r1_3x_shadow_scheduler(text,integer) from public,anon,authenticated;
revoke all on function public.hq_workforce_run_shadow_cycle(text,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_run_r1_3x_shadow_scheduler(text,integer) to service_role;
grant execute on function public.hq_workforce_run_shadow_cycle(text,integer) to service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype; d text;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'X7 scheduler reconciliation: runtime contract missing'; end if;
  if public.hq_workforce_legacy_heartbeat_cron_present() then raise exception 'X7 scheduler reconciliation: legacy heartbeat cron remains installed'; end if;
  select lower(pg_get_functiondef('public.hq_workforce_run_shadow_cycle(text,integer)'::regprocedure)) into d;
  if position('hq_work_items' in d)>0 or position('hq_workforce_autonomous_heartbeat' in d)>0 then raise exception 'X7 scheduler reconciliation: compatibility shadow cycle retains legacy bypass'; end if;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0
     or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then raise exception 'X7 scheduler reconciliation violated fail-closed L0/R0 boundary'; end if;
end $$;
