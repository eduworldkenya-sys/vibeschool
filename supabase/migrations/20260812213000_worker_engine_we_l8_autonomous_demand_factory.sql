-- Worker Engine WE-L8: telemetry-driven autonomous workforce demand loop.
-- Converts authoritative gap telemetry into governed factory decisions.
-- Disabled by default. No certification or activation occurs here.
-- access: service-only public.hq_workforce_factory_templates
-- authorization-test: public.hq_workforce_factory_templates anon/authenticated denied; service_role only.

create table public.hq_workforce_factory_templates (
 id uuid primary key default gen_random_uuid(),
 template_key text not null,
 version integer not null check(version>0),
 lane_key text not null,
 signal_type text not null,
 title text not null,
 mission text not null,
 capability_key text not null,
 operation text not null,
 resource_type text not null,
 scope_type text not null default 'platform_internal' check(scope_type in ('platform_internal','global','school','multi_school')),
 scope_ref jsonb not null default '{}'::jsonb,
 max_live_workers integer not null default 1 check(max_live_workers between 1 and 20),
 status text not null default 'draft' check(status in ('draft','approved','superseded','revoked')),
 approved_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 unique(template_key,version),
 check(status<>'approved' or approved_at is not null)
);

alter table public.hq_workforce_engine_contract add column if not exists factory_enabled boolean not null default false;
alter table public.hq_workforce_engine_contract add column if not exists factory_limit integer not null default 10 check(factory_limit between 1 and 50);

create or replace function public.hq_workforce_authoritative_demand_metrics(p_gap_id uuid,p_template_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare g public.hq_workforce_gap_signals%rowtype; t public.hq_workforce_factory_templates%rowtype; v_department text; v_existing boolean; v_skilled boolean; v_metrics jsonb;
begin
 select * into g from public.hq_workforce_gap_signals where id=p_gap_id; if not found then raise exception 'gap_not_found'; end if;
 select * into t from public.hq_workforce_factory_templates where id=p_template_id and status='approved'; if not found then raise exception 'approved_factory_template_required'; end if;
 if t.lane_key<>g.lane_key or t.signal_type<>g.signal_type then raise exception 'factory_template_gap_mismatch'; end if;
 select coalesce(l.department_key,g.lane_key) into v_department from public.hq_workforce_lanes l where l.lane_key=g.lane_key;
 v_department:=coalesce(v_department,g.lane_key);
 select exists(select 1 from public.hq_workforce_workers w where w.department_key=v_department and public.hq_workforce_current_lifecycle_state(w.worker_key) in ('shadow','certification_pending','certified','active','remediation')) into v_existing;
 select exists(select 1 from public.hq_workforce_workers w where w.department_key=v_department and public.hq_workforce_current_lifecycle_state(w.worker_key) in ('certified','active') and w.permissions @> jsonb_build_array(t.capability_key)) into v_skilled;
 v_metrics:=jsonb_build_object(
   'downstream_dependency_count',coalesce((g.metrics_snapshot->>'downstream_dependency_count')::int,0),
   'verified_impact',coalesce((g.metrics_snapshot->>'verified_impact')::numeric,0),
   'rework_rate',coalesce((g.metrics_snapshot->>'rework_rate')::numeric,0),
   'policy_violations',coalesce((g.metrics_snapshot->>'policy_violations')::int,0),
   'deterministic_automation_sufficient',coalesce((g.metrics_snapshot->>'deterministic_automation_sufficient')::boolean,false),
   'existing_worker_available',v_existing,
   'existing_worker_has_skill',v_skilled,
   'existing_worker_utilization',case when v_existing then coalesce((g.metrics_snapshot->>'existing_worker_utilization')::numeric,1) else null end,
   'rebalance_capacity',coalesce((g.metrics_snapshot->>'rebalance_capacity')::boolean,false),
   'demand_temporary',coalesce((g.metrics_snapshot->>'demand_temporary')::boolean,false),
   'human_judgment_required',coalesce((g.metrics_snapshot->>'human_judgment_required')::boolean,false),
   'required_capability_key',t.capability_key,
   'telemetry_source','gap_signal_authoritative_v1'
 );
 return v_metrics;
end $$;

create or replace function public.hq_workforce_autonomous_factory_heartbeat(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare g record; t public.hq_workforce_factory_templates%rowtype; v_metrics jsonb; v_result jsonb; v_processed int:=0; v_created int:=0; v_rejected int:=0; v_skipped int:=0; v_worker_key text; v_live int;
begin
 if p_limit<1 or p_limit>50 then raise exception 'invalid_factory_limit'; end if;
 for g in
   select gs.* from public.hq_workforce_gap_signals gs
   where gs.status in ('candidate','accepted')
     and not exists(select 1 from public.hq_workforce_demand_evidence de where de.gap_id=gs.id)
   order by case gs.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,gs.detected_at
   for update skip locked limit p_limit
 loop
   select * into t from public.hq_workforce_factory_templates ft where ft.lane_key=g.lane_key and ft.signal_type=g.signal_type and ft.status='approved' order by ft.version desc limit 1;
   if not found then v_skipped:=v_skipped+1; continue; end if;
   select count(*) into v_live from public.hq_workforce_workers w where w.department_key=coalesce((select l.department_key from public.hq_workforce_lanes l where l.lane_key=g.lane_key),g.lane_key) and public.hq_workforce_current_lifecycle_state(w.worker_key) in ('shadow','certification_pending','certified','active','remediation') and w.permissions @> jsonb_build_array(t.capability_key);
   if v_live>=t.max_live_workers then
     v_metrics:=public.hq_workforce_authoritative_demand_metrics(g.id,t.id)||jsonb_build_object('existing_worker_available',true,'existing_worker_has_skill',true);
   else
     v_metrics:=public.hq_workforce_authoritative_demand_metrics(g.id,t.id);
   end if;
   v_worker_key:='auto_'||regexp_replace(g.lane_key,'[^a-zA-Z0-9]+','_','g')||'_'||substr(replace(g.id::text,'-',''),1,12);
   v_result:=public.hq_workforce_factory_cycle(g.id,v_metrics,v_worker_key,t.title,t.mission,t.capability_key,t.operation,t.resource_type);
   v_processed:=v_processed+1;
   if coalesce((v_result->>'worker_created')::boolean,false) then v_created:=v_created+1; else v_rejected:=v_rejected+1; end if;
 end loop;
 return jsonb_build_object('processed',v_processed,'created',v_created,'rejected',v_rejected,'skipped_no_template',v_skipped,'mode','deterministic','factory_activation','shadow_only');
end $$;

create or replace function public.hq_workforce_scheduled_factory_heartbeat()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_enabled boolean; v_limit integer;
begin
 select factory_enabled,factory_limit into v_enabled,v_limit from public.hq_workforce_engine_contract where singleton=true;
 if not coalesce(v_enabled,false) then return jsonb_build_object('status','disabled','mode','deterministic'); end if;
 return public.hq_workforce_autonomous_factory_heartbeat(coalesce(v_limit,10));
end $$;

insert into public.hq_workforce_factory_templates(template_key,version,lane_key,signal_type,title,mission,capability_key,operation,resource_type,status,approved_at)
values('operations_capacity_triage',1,'operations','capacity_gap','Autonomous Operations Capacity Worker','Absorb sustained bounded Operations triage capacity only after deterministic workforce diagnosis.','work_item.triage','update','hq_work_items','approved',clock_timestamp())
on conflict(template_key,version) do nothing;

create or replace function public.hq_workforce_guard_factory_template_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' and old.status<>'draft' then raise exception 'approved_factory_template_delete_forbidden'; end if;
 if tg_op='UPDATE' and old.status<>'draft' then
  if (new.template_key,new.version,new.lane_key,new.signal_type,new.title,new.mission,new.capability_key,new.operation,new.resource_type,new.scope_type,new.scope_ref,new.max_live_workers,new.approved_at,new.created_at) is distinct from (old.template_key,old.version,old.lane_key,old.signal_type,old.title,old.mission,old.capability_key,old.operation,old.resource_type,old.scope_type,old.scope_ref,old.max_live_workers,old.approved_at,old.created_at) then raise exception 'approved_factory_template_immutable'; end if;
  if old.status<>new.status and not(old.status='approved' and new.status in ('superseded','revoked')) then raise exception 'illegal_factory_template_status_transition'; end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger trg_hq_workforce_guard_factory_template_mutation before update or delete on public.hq_workforce_factory_templates for each row execute function public.hq_workforce_guard_factory_template_mutation();

alter table public.hq_workforce_factory_templates enable row level security;
revoke all on table public.hq_workforce_factory_templates from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.hq_workforce_factory_templates to service_role;
revoke all on function public.hq_workforce_authoritative_demand_metrics(uuid,uuid),public.hq_workforce_autonomous_factory_heartbeat(integer),public.hq_workforce_scheduled_factory_heartbeat(),public.hq_workforce_guard_factory_template_mutation() from public,anon,authenticated;
grant execute on function public.hq_workforce_authoritative_demand_metrics(uuid,uuid),public.hq_workforce_autonomous_factory_heartbeat(integer),public.hq_workforce_scheduled_factory_heartbeat(),public.hq_workforce_guard_factory_template_mutation() to service_role;
