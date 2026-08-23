-- Laban Command Supremacy Controls v1 — NON-ACTIVATING.
-- Adds counterfactual planning, evidence confidence, two-key approvals, succession/failover,
-- role separation, architecture-drift invariants and post-mission learning.
-- This migration does NOT enable runtime, schedulers, publishing, payments, autonomy, or authority grants.
-- access: service-only public.hq_workforce_command_hypotheses
-- authorization-test: public.hq_workforce_command_hypotheses denies public/anon/authenticated direct access.
-- access: service-only public.hq_workforce_command_risk_allocations
-- authorization-test: public.hq_workforce_command_risk_allocations denies public/anon/authenticated direct access.
-- access: service-only public.hq_workforce_command_two_key_approvals
-- authorization-test: public.hq_workforce_command_two_key_approvals denies public/anon/authenticated direct access.
-- access: service-only public.hq_workforce_command_assurance_assignments
-- authorization-test: public.hq_workforce_command_assurance_assignments denies public/anon/authenticated direct access.
-- access: service-only public.hq_workforce_command_failover
-- authorization-test: public.hq_workforce_command_failover denies public/anon/authenticated direct access.
-- access: service-only public.hq_workforce_command_learning_cases
-- authorization-test: public.hq_workforce_command_learning_cases denies public/anon/authenticated direct access.
-- access: service-only public.hq_workforce_architecture_invariants
-- authorization-test: public.hq_workforce_architecture_invariants denies public/anon/authenticated direct access.

create table if not exists public.hq_workforce_command_hypotheses (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.hq_workforce_command_missions(id) on delete cascade,
  hypothesis text not null check (char_length(btrim(hypothesis)) between 3 and 4000),
  counterfactual text not null check (char_length(btrim(counterfactual)) between 3 and 4000),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_quality smallint not null check (evidence_quality between 0 and 5),
  status text not null default 'open' check (status in ('open','supported','contradicted','retired')),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  created_by text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.hq_workforce_command_risk_allocations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.hq_workforce_command_missions(id) on delete cascade,
  allocation_key text not null,
  scope_type text not null,
  scope_ref jsonb not null default '{}'::jsonb check (jsonb_typeof(scope_ref)='object'),
  max_risk smallint not null check (max_risk between 0 and 5),
  max_operations integer not null check (max_operations between 0 and 100000),
  max_records integer not null check (max_records between 0 and 1000000),
  max_cost_units numeric not null default 0 check (max_cost_units >= 0),
  expires_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','active','exhausted','expired','revoked')),
  created_at timestamptz not null default clock_timestamp(),
  unique(mission_id,allocation_key)
);

create table if not exists public.hq_workforce_command_two_key_approvals (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.hq_workforce_command_missions(id) on delete cascade,
  subject_type text not null,
  subject_ref text not null,
  requested_by text not null,
  approver_one text,
  approver_two text,
  status text not null default 'requested' check (status in ('requested','one_approved','approved','rejected','expired','revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (approver_one is null or approver_one <> requested_by),
  check (approver_two is null or approver_two <> requested_by),
  check (approver_one is null or approver_two is null or approver_one <> approver_two),
  unique(mission_id,subject_type,subject_ref)
);

create table if not exists public.hq_workforce_command_assurance_assignments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.hq_workforce_command_missions(id) on delete cascade,
  commander_key text not null,
  executor_key text not null,
  verifier_key text not null,
  security_observer_key text,
  status text not null default 'assigned' check (status in ('assigned','active','complete','revoked')),
  created_at timestamptz not null default clock_timestamp(),
  check (commander_key <> executor_key),
  check (commander_key <> verifier_key),
  check (executor_key <> verifier_key),
  check (security_observer_key is null or security_observer_key not in (commander_key,executor_key,verifier_key)),
  unique(mission_id,executor_key,verifier_key)
);

create table if not exists public.hq_workforce_command_failover (
  mission_id uuid primary key references public.hq_workforce_command_missions(id) on delete cascade,
  primary_commander_key text not null,
  successor_commander_key text not null,
  activated_by text,
  activation_reason text,
  status text not null default 'standby' check (status in ('standby','activated','revoked')),
  activated_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check (primary_commander_key <> successor_commander_key)
);

create table if not exists public.hq_workforce_command_learning_cases (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.hq_workforce_command_missions(id) on delete restrict,
  category text not null,
  trigger_event text not null,
  root_cause jsonb not null,
  invariant_added text,
  regression_test_ref text,
  evidence_hash text not null,
  created_by text not null,
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.hq_workforce_architecture_invariants (
  invariant_key text primary key,
  description text not null,
  severity text not null check (severity in ('warning','blocking','critical')),
  enforcement_mode text not null check (enforcement_mode in ('ci','database','both')),
  enabled boolean not null default true,
  created_at timestamptz not null default clock_timestamp()
);

insert into public.hq_workforce_architecture_invariants(invariant_key,description,severity,enforcement_mode)
values
 ('single_consequential_gateway','All consequential Worker Engine mutations must traverse hq_workforce_consequential_execution_gateway or a certified successor explicitly replacing it.','critical','both'),
 ('no_self_authority','Worker execution may not mint, activate, widen, or self-grant capability authority.','critical','both'),
 ('no_self_certification','Commander/executor may not independently verify their own consequential outcome.','critical','both'),
 ('scheduler_no_authority','Schedulers and heartbeats may create demand but never confer consequential authority.','critical','both'),
 ('contradiction_reopens','Blocking contrary evidence invalidates completion/certification until independently re-proven.','blocking','both')
on conflict (invariant_key) do update
set description=excluded.description,severity=excluded.severity,enforcement_mode=excluded.enforcement_mode,enabled=true;

alter table public.hq_workforce_command_hypotheses enable row level security;
alter table public.hq_workforce_command_risk_allocations enable row level security;
alter table public.hq_workforce_command_two_key_approvals enable row level security;
alter table public.hq_workforce_command_assurance_assignments enable row level security;
alter table public.hq_workforce_command_failover enable row level security;
alter table public.hq_workforce_command_learning_cases enable row level security;
alter table public.hq_workforce_architecture_invariants enable row level security;

revoke all on public.hq_workforce_command_hypotheses from public,anon,authenticated;
revoke all on public.hq_workforce_command_risk_allocations from public,anon,authenticated;
revoke all on public.hq_workforce_command_two_key_approvals from public,anon,authenticated;
revoke all on public.hq_workforce_command_assurance_assignments from public,anon,authenticated;
revoke all on public.hq_workforce_command_failover from public,anon,authenticated;
revoke all on public.hq_workforce_command_learning_cases from public,anon,authenticated;
revoke all on public.hq_workforce_architecture_invariants from public,anon,authenticated;

create or replace function public.hq_workforce_command_assert_role_separation(
  p_mission_id uuid,p_commander_key text,p_executor_key text,p_verifier_key text,p_security_observer_key text default null
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_commander_key=p_executor_key or p_commander_key=p_verifier_key or p_executor_key=p_verifier_key then
    raise exception 'command_role_separation_violation';
  end if;
  if p_security_observer_key is not null and p_security_observer_key in (p_commander_key,p_executor_key,p_verifier_key) then
    raise exception 'command_security_observer_not_independent';
  end if;
  if not exists(select 1 from public.hq_workforce_command_missions where id=p_mission_id) then raise exception 'command_mission_not_found'; end if;
  return true;
end $$;

create or replace function public.hq_workforce_command_approve_two_key(p_approval_id uuid,p_approver_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.hq_workforce_command_two_key_approvals%rowtype;
begin
  select * into a from public.hq_workforce_command_two_key_approvals where id=p_approval_id for update;
  if not found then raise exception 'two_key_request_not_found'; end if;
  if a.status in ('approved','rejected','expired','revoked') then raise exception 'two_key_request_closed'; end if;
  if a.expires_at<=clock_timestamp() then
    update public.hq_workforce_command_two_key_approvals set status='expired',updated_at=clock_timestamp() where id=a.id;
    raise exception 'two_key_request_expired';
  end if;
  if p_approver_key=a.requested_by then raise exception 'requester_cannot_approve_two_key'; end if;
  if exists(select 1 from public.hq_workforce_workers where worker_key=p_approver_key) then raise exception 'worker_cannot_serve_as_human_two_key_approver'; end if;
  if a.approver_one is null then
    update public.hq_workforce_command_two_key_approvals set approver_one=p_approver_key,status='one_approved',updated_at=clock_timestamp() where id=a.id;
  elsif a.approver_one=p_approver_key then
    raise exception 'two_key_distinct_approver_required';
  else
    update public.hq_workforce_command_two_key_approvals set approver_two=p_approver_key,status='approved',updated_at=clock_timestamp() where id=a.id;
  end if;
  select * into a from public.hq_workforce_command_two_key_approvals where id=p_approval_id;
  perform public.hq_workforce_command_append_event(a.mission_id,p_approver_key,'two_key.approved',jsonb_build_object('approval_id',a.id,'status',a.status));
  return jsonb_build_object('approval_id',a.id,'status',a.status,'approver_one',a.approver_one,'approver_two',a.approver_two);
end $$;

create or replace function public.hq_workforce_command_activate_failover(p_mission_id uuid,p_activated_by text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.hq_workforce_command_failover%rowtype; m public.hq_workforce_command_missions%rowtype;
begin
  select * into f from public.hq_workforce_command_failover where mission_id=p_mission_id for update;
  if not found then raise exception 'command_failover_not_configured'; end if;
  select * into m from public.hq_workforce_command_missions where id=p_mission_id for update;
  if not found then raise exception 'command_mission_not_found'; end if;
  if p_activated_by in (f.primary_commander_key,f.successor_commander_key) then raise exception 'failover_requires_independent_activation'; end if;
  if exists(select 1 from public.hq_workforce_workers where worker_key=p_activated_by) then raise exception 'worker_cannot_activate_command_failover'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<5 then raise exception 'failover_reason_required'; end if;
  if f.status<>'standby' then raise exception 'failover_not_standby'; end if;
  update public.hq_workforce_command_failover set status='activated',activated_by=p_activated_by,activation_reason=p_reason,activated_at=clock_timestamp() where mission_id=p_mission_id;
  update public.hq_workforce_command_missions set commander_key=f.successor_commander_key,state='reopened',completed_at=null,updated_at=clock_timestamp() where id=p_mission_id;
  perform public.hq_workforce_command_append_event(p_mission_id,p_activated_by,'command.failover_activated',jsonb_build_object('from',f.primary_commander_key,'to',f.successor_commander_key,'reason',p_reason));
  return jsonb_build_object('mission_id',p_mission_id,'commander_key',f.successor_commander_key,'state','reopened');
end $$;

create or replace function public.hq_workforce_command_complete_mission(p_mission_id uuid,p_verifier_key text,p_evidence_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.hq_workforce_command_missions%rowtype; v_two_key boolean;
begin
  select * into m from public.hq_workforce_command_missions where id=p_mission_id for update;
  if not found then raise exception 'command_mission_not_found'; end if;
  if p_verifier_key=m.commander_key then raise exception 'commander_cannot_self_certify'; end if;
  if coalesce(p_evidence_hash,'')='' then raise exception 'mission_evidence_required'; end if;
  if not exists(select 1 from public.hq_workforce_command_assurance_assignments a where a.mission_id=p_mission_id and a.verifier_key=p_verifier_key and a.status in ('assigned','active','complete')) then
    raise exception 'independent_verifier_assignment_required';
  end if;
  if exists(select 1 from public.hq_workforce_command_challenges where mission_id=p_mission_id and status='open' and severity in ('blocking','critical')) then raise exception 'mission_has_open_blocking_challenges'; end if;
  if exists(select 1 from public.hq_workforce_command_delegations where mission_id=p_mission_id and status not in ('complete','revoked')) then raise exception 'mission_has_unfinished_delegations'; end if;
  v_two_key:=coalesce((m.risk_budget->>'requires_two_key')::boolean,false);
  if v_two_key and not exists(select 1 from public.hq_workforce_command_two_key_approvals where mission_id=p_mission_id and status='approved' and expires_at>clock_timestamp()) then
    raise exception 'mission_two_key_approval_required';
  end if;
  update public.hq_workforce_command_missions set state='complete',evidence_hash=p_evidence_hash,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_mission_id;
  perform public.hq_workforce_command_append_event(p_mission_id,p_verifier_key,'mission.certified',jsonb_build_object('evidence_hash',p_evidence_hash,'two_key_required',v_two_key));
  return jsonb_build_object('mission_id',p_mission_id,'state','complete','verifier_key',p_verifier_key,'two_key_required',v_two_key);
end $$;

revoke all on function public.hq_workforce_command_assert_role_separation(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_command_approve_two_key(uuid,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_command_activate_failover(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_command_assert_role_separation(uuid,text,text,text,text) to service_role;
grant execute on function public.hq_workforce_command_approve_two_key(uuid,text) to service_role;
grant execute on function public.hq_workforce_command_activate_failover(uuid,text,text) to service_role;

-- Final non-activation invariant.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; v_active integer; begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'command_supremacy_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'command_supremacy_non_activating_boundary_violated';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'command_supremacy_must_not_activate_authority'; end if;
end $$;
