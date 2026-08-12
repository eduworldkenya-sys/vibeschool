-- WE-L11: deterministic workforce-demand sensor.
-- Real HQ backlog/SLA telemetry -> sustained observation -> gap signal.
-- access: service-only public.hq_workforce_demand_sensor_policies
-- authorization-test: public.hq_workforce_demand_sensor_policies anon/authenticated denied; service_role only.
-- access: service-only public.hq_workforce_demand_observations
-- authorization-test: public.hq_workforce_demand_observations anon/authenticated denied; service_role only.

create table public.hq_workforce_demand_sensor_policies (
 id uuid primary key default gen_random_uuid(),
 policy_key text not null,
 version integer not null check(version>0),
 template_id uuid not null references public.hq_workforce_factory_templates(id) on delete restrict,
 min_open_backlog integer not null check(min_open_backlog>0),
 oldest_age_minutes integer not null check(oldest_age_minutes>0),
 consecutive_observations integer not null default 3 check(consecutive_observations between 2 and 20),
 observation_window_minutes integer not null default 15 check(observation_window_minutes between 2 and 120),
 cooldown_minutes integer not null default 60 check(cooldown_minutes between 1 and 1440),
 status text not null default 'draft' check(status in ('draft','approved','superseded','revoked')),
 approved_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 unique(policy_key,version),
 check(status<>'approved' or approved_at is not null)
);

create table public.hq_workforce_demand_observations (
 id bigint generated always as identity primary key,
 policy_id uuid not null references public.hq_workforce_demand_sensor_policies(id) on delete restrict,
 observed_bucket timestamptz not null,
 open_backlog integer not null check(open_backlog>=0),
 oldest_age_seconds integer not null check(oldest_age_seconds>=0),
 weighted_impact numeric not null check(weighted_impact>=0),
 threshold_met boolean not null,
 evidence jsonb not null,
 observed_at timestamptz not null default clock_timestamp(),
 unique(policy_id,observed_bucket)
);

insert into public.hq_workforce_demand_sensor_policies(policy_key,version,template_id,min_open_backlog,oldest_age_minutes,consecutive_observations,observation_window_minutes,cooldown_minutes,status,approved_at)
select 'operations_triage_capacity_sensor',1,t.id,5,15,3,15,60,'approved',clock_timestamp()
from public.hq_workforce_factory_templates t
where t.template_key='operations_capacity_triage' and t.version=1
on conflict(policy_key,version) do nothing;

create or replace function public.hq_workforce_observe_demand_sensors()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p record; v_department text; v_backlog int; v_oldest int; v_impact numeric; v_met boolean; v_recent_met int; v_gap uuid; v_observed int:=0; v_emitted int:=0; v_bucket timestamptz;
begin
 v_bucket:=date_trunc('minute',clock_timestamp());
 for p in select sp.*,t.lane_key,t.signal_type from public.hq_workforce_demand_sensor_policies sp join public.hq_workforce_factory_templates t on t.id=sp.template_id and t.status='approved' where sp.status='approved' loop
   select coalesce(l.department_key,p.lane_key) into v_department from public.hq_workforce_lanes l where l.lane_key=p.lane_key; v_department:=coalesce(v_department,p.lane_key);
   select count(*),coalesce(extract(epoch from (clock_timestamp()-min(created_at)))::int,0),coalesce(sum(case priority when 'critical' then 3 when 'high' then 2 else 1 end),0)
     into v_backlog,v_oldest,v_impact
   from public.hq_work_items
   where department_key=v_department and status='open' and approval_required=false and coalesce(action_taken,'{}'::jsonb)='{}'::jsonb;
   v_met:=v_backlog>=p.min_open_backlog and v_oldest>=p.oldest_age_minutes*60;
   insert into public.hq_workforce_demand_observations(policy_id,observed_bucket,open_backlog,oldest_age_seconds,weighted_impact,threshold_met,evidence)
   values(p.id,v_bucket,v_backlog,v_oldest,v_impact,v_met,jsonb_build_object('department_key',v_department,'backlog',v_backlog,'oldest_age_seconds',v_oldest,'weighted_impact',v_impact,'source','hq_work_items'))
   on conflict(policy_id,observed_bucket) do nothing;
   if found then v_observed:=v_observed+1; end if;
   select count(*) into v_recent_met from public.hq_workforce_demand_observations o where o.policy_id=p.id and o.threshold_met and o.observed_at>=clock_timestamp()-make_interval(mins=>p.observation_window_minutes);
   if v_met and v_recent_met>=p.consecutive_observations and not exists(select 1 from public.hq_workforce_gap_signals gs where gs.source_type='workforce_sensor' and gs.source_ref=p.id::text and gs.detected_at>=clock_timestamp()-make_interval(mins=>p.cooldown_minutes)) then
     insert into public.hq_workforce_gap_signals(gap_key,source_type,source_ref,lane_key,signal_type,metrics_snapshot,severity,status)
     values('sensor:'||p.policy_key||':'||to_char(v_bucket,'YYYYMMDDHH24MI'),'workforce_sensor',p.id::text,p.lane_key,p.signal_type,jsonb_build_object('downstream_dependency_count',v_backlog,'verified_impact',v_impact,'rework_rate',0,'policy_violations',0,'deterministic_automation_sufficient',false,'demand_temporary',false,'human_judgment_required',false,'observed_backlog',v_backlog,'oldest_age_seconds',v_oldest,'sensor_policy_key',p.policy_key),case when v_backlog>=p.min_open_backlog*3 then 'critical' when v_backlog>=p.min_open_backlog*2 then 'high' else 'medium' end,'candidate') returning id into v_gap;
     v_emitted:=v_emitted+1;
   end if;
 end loop;
 return jsonb_build_object('observations_written',v_observed,'gaps_emitted',v_emitted,'mode','deterministic','sustained_required',true);
end $$;

create or replace function public.hq_workforce_scheduled_heartbeat()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_hb boolean; v_factory boolean; v_hb_limit integer; v_factory_limit integer; v_sensor jsonb; v_factory_result jsonb; v_qual_result jsonb; v_runtime_result jsonb;
begin
 select heartbeat_enabled,factory_enabled,heartbeat_limit,factory_limit into v_hb,v_factory,v_hb_limit,v_factory_limit from public.hq_workforce_engine_contract where singleton=true;
 if not coalesce(v_hb,false) and not coalesce(v_factory,false) then return jsonb_build_object('status','disabled','mode','deterministic'); end if;
 if coalesce(v_factory,false) then
   v_sensor:=public.hq_workforce_observe_demand_sensors();
   v_factory_result:=public.hq_workforce_autonomous_factory_heartbeat(coalesce(v_factory_limit,10));
   v_qual_result:=public.hq_workforce_qualify_factory_workers(coalesce(v_factory_limit,10));
 else v_sensor:='{"status":"disabled"}'::jsonb; v_factory_result:='{"status":"disabled"}'::jsonb; v_qual_result:='{"status":"disabled"}'::jsonb; end if;
 if coalesce(v_hb,false) then v_runtime_result:=public.hq_workforce_autonomous_heartbeat(coalesce(v_hb_limit,20)); else v_runtime_result:='{"status":"disabled"}'::jsonb; end if;
 return jsonb_build_object('sensor',v_sensor,'factory',v_factory_result,'qualification',v_qual_result,'runtime',v_runtime_result,'mode','deterministic');
end $$;

create or replace function public.hq_workforce_guard_demand_observation_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin raise exception 'demand_observation_immutable'; end $$;
create trigger trg_hq_workforce_guard_demand_observation_mutation before update or delete on public.hq_workforce_demand_observations for each row execute function public.hq_workforce_guard_demand_observation_mutation();

create or replace function public.hq_workforce_guard_demand_sensor_policy_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' and old.status<>'draft' then raise exception 'approved_sensor_policy_delete_forbidden'; end if;
 if tg_op='UPDATE' and old.status<>'draft' then
  if (new.policy_key,new.version,new.template_id,new.min_open_backlog,new.oldest_age_minutes,new.consecutive_observations,new.observation_window_minutes,new.cooldown_minutes,new.approved_at,new.created_at) is distinct from (old.policy_key,old.version,old.template_id,old.min_open_backlog,old.oldest_age_minutes,old.consecutive_observations,old.observation_window_minutes,old.cooldown_minutes,old.approved_at,old.created_at) then raise exception 'approved_sensor_policy_immutable'; end if;
  if old.status<>new.status and not(old.status='approved' and new.status in ('superseded','revoked')) then raise exception 'illegal_sensor_policy_status_transition'; end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger trg_hq_workforce_guard_demand_sensor_policy_mutation before update or delete on public.hq_workforce_demand_sensor_policies for each row execute function public.hq_workforce_guard_demand_sensor_policy_mutation();

alter table public.hq_workforce_demand_sensor_policies enable row level security;
alter table public.hq_workforce_demand_observations enable row level security;
revoke all on table public.hq_workforce_demand_sensor_policies,public.hq_workforce_demand_observations from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.hq_workforce_demand_sensor_policies to service_role;
grant select,insert on table public.hq_workforce_demand_observations to service_role;
grant usage,select on sequence public.hq_workforce_demand_observations_id_seq to service_role;
revoke all on function public.hq_workforce_observe_demand_sensors(),public.hq_workforce_scheduled_heartbeat(),public.hq_workforce_guard_demand_observation_mutation(),public.hq_workforce_guard_demand_sensor_policy_mutation() from public,anon,authenticated;
grant execute on function public.hq_workforce_observe_demand_sensors(),public.hq_workforce_scheduled_heartbeat(),public.hq_workforce_guard_demand_observation_mutation(),public.hq_workforce_guard_demand_sensor_policy_mutation() to service_role;
