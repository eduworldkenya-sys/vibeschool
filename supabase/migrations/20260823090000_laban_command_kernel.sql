-- Laban Command Kernel v1 — NON-ACTIVATING.
-- Durable mission command, delegation, challenge and assurance contracts.
-- Command never confers consequential authority; R1.4 remains the only mutation authority chain.

create table if not exists public.hq_workforce_command_missions (
 id uuid primary key default gen_random_uuid(), commander_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
 objective_id uuid references public.hq_workforce_objectives(id) on delete restrict, title text not null,
 success_criteria jsonb not null default '[]'::jsonb check(jsonb_typeof(success_criteria)='array'), risk_budget jsonb not null default '{}'::jsonb check(jsonb_typeof(risk_budget)='object'),
 state text not null default 'planned' check(state in ('planned','active','blocked','owner_required','failed_safe','verifying','complete','reopened','stopped')),
 evidence_hash text, contradiction_count integer not null default 0 check(contradiction_count>=0), created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(), completed_at timestamptz);

create table if not exists public.hq_workforce_command_delegations (
 id uuid primary key default gen_random_uuid(), mission_id uuid not null references public.hq_workforce_command_missions(id) on delete cascade,
 commander_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
 worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
 plan_step_id uuid references public.hq_workforce_plan_steps(id) on delete restrict, capability_key text not null, capability_version integer not null check(capability_version>0),
 authority_grant_id uuid references public.hq_workforce_capability_authority_grants(id) on delete restrict, scope_type text not null, scope_ref jsonb not null default '{}'::jsonb check(jsonb_typeof(scope_ref)='object'),
 status text not null default 'proposed' check(status in ('proposed','authorized','working','waiting_review','blocked','complete','revoked')),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(), check(commander_key<>worker_key));

create table if not exists public.hq_workforce_command_challenges (
 id uuid primary key default gen_random_uuid(), mission_id uuid not null references public.hq_workforce_command_missions(id) on delete cascade,
 challenger_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
 subject_type text not null, subject_ref text not null, severity text not null check(severity in ('info','warning','blocking','critical')), finding jsonb not null,
 status text not null default 'open' check(status in ('open','accepted','rejected','resolved')), created_at timestamptz not null default clock_timestamp(), resolved_at timestamptz);

create table if not exists public.hq_workforce_command_ledger (
 id bigint generated always as identity primary key, mission_id uuid not null references public.hq_workforce_command_missions(id) on delete restrict,
 actor_key text not null, event_type text not null, event jsonb not null, previous_hash text, event_hash text not null, created_at timestamptz not null default clock_timestamp());

alter table public.hq_workforce_command_missions enable row level security; alter table public.hq_workforce_command_delegations enable row level security;
alter table public.hq_workforce_command_challenges enable row level security; alter table public.hq_workforce_command_ledger enable row level security;
revoke all on public.hq_workforce_command_missions,public.hq_workforce_command_delegations,public.hq_workforce_command_challenges,public.hq_workforce_command_ledger from public,anon,authenticated;

create or replace function public.hq_workforce_command_append_event(p_mission_id uuid,p_actor_key text,p_event_type text,p_event jsonb) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_prev text;v_hash text;v_id bigint;begin
 if coalesce(p_actor_key,'')='' or coalesce(p_event_type,'')='' then raise exception 'command_event_identity_required';end if;
 perform 1 from public.hq_workforce_command_missions where id=p_mission_id for update;if not found then raise exception 'command_mission_not_found';end if;
 select event_hash into v_prev from public.hq_workforce_command_ledger where mission_id=p_mission_id order by id desc limit 1;
 v_hash:=encode(digest(coalesce(v_prev,'')||p_mission_id::text||p_actor_key||p_event_type||p_event::text,'sha256'),'hex');
 insert into public.hq_workforce_command_ledger(mission_id,actor_key,event_type,event,previous_hash,event_hash) values(p_mission_id,p_actor_key,p_event_type,p_event,v_prev,v_hash) returning id into v_id;return v_id;end$$;

create or replace function public.hq_workforce_command_assert_delegation(p_delegation_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.hq_workforce_command_delegations%rowtype;m public.hq_workforce_command_missions%rowtype;g public.hq_workforce_capability_authority_grants%rowtype;begin
 select * into d from public.hq_workforce_command_delegations where id=p_delegation_id for update;if not found then raise exception 'delegation_not_found';end if;
 select * into m from public.hq_workforce_command_missions where id=d.mission_id;if not found or m.state not in('active','verifying') then raise exception 'mission_not_executable';end if;
 if d.commander_key is distinct from m.commander_key then raise exception 'delegation_commander_mismatch';end if;if d.authority_grant_id is null then raise exception 'delegation_authority_required';end if;
 select * into g from public.hq_workforce_capability_authority_grants where id=d.authority_grant_id;
 if not found or g.status<>'active' or g.expires_at<=clock_timestamp() then raise exception 'delegation_authority_inactive';end if;
 if g.permitted_worker_key is distinct from d.worker_key or g.capability_key is distinct from d.capability_key or g.capability_version is distinct from d.capability_version or g.scope_type is distinct from d.scope_type or g.scope_ref is distinct from d.scope_ref then raise exception 'delegation_authority_mismatch';end if;
 if exists(select 1 from public.hq_workforce_command_challenges c where c.mission_id=d.mission_id and c.status='open' and c.severity in('blocking','critical')) then raise exception 'mission_blocked_by_challenge';end if;
 return jsonb_build_object('decision','allow','mission_id',d.mission_id,'worker_key',d.worker_key,'authority_grant_id',d.authority_grant_id);end$$;

create or replace function public.hq_workforce_command_record_challenge(p_mission_id uuid,p_challenger_key text,p_subject_type text,p_subject_ref text,p_severity text,p_finding jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.hq_workforce_command_missions%rowtype;v_id uuid;begin
 select * into m from public.hq_workforce_command_missions where id=p_mission_id for update;if not found then raise exception 'command_mission_not_found';end if;
 if p_challenger_key=m.commander_key then raise exception 'commander_cannot_independently_challenge_self';end if;
 insert into public.hq_workforce_command_challenges(mission_id,challenger_key,subject_type,subject_ref,severity,finding) values(p_mission_id,p_challenger_key,p_subject_type,p_subject_ref,p_severity,p_finding) returning id into v_id;
 if p_severity in('blocking','critical') then update public.hq_workforce_command_missions set state='reopened',contradiction_count=contradiction_count+1,completed_at=null,updated_at=clock_timestamp() where id=p_mission_id;end if;
 perform public.hq_workforce_command_append_event(p_mission_id,p_challenger_key,'challenge.recorded',jsonb_build_object('challenge_id',v_id,'severity',p_severity));return v_id;end$$;

create or replace function public.hq_workforce_command_complete_mission(p_mission_id uuid,p_verifier_key text,p_evidence_hash text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.hq_workforce_command_missions%rowtype;begin
 select * into m from public.hq_workforce_command_missions where id=p_mission_id for update;if not found then raise exception 'command_mission_not_found';end if;
 if p_verifier_key=m.commander_key then raise exception 'commander_cannot_self_certify';end if;if not exists(select 1 from public.hq_workforce_workers where worker_key=p_verifier_key) then raise exception 'verifier_not_found';end if;
 if coalesce(p_evidence_hash,'')='' then raise exception 'mission_evidence_required';end if;
 if exists(select 1 from public.hq_workforce_command_challenges where mission_id=p_mission_id and status='open' and severity in('blocking','critical')) then raise exception 'mission_has_open_blocking_challenges';end if;
 if exists(select 1 from public.hq_workforce_command_delegations where mission_id=p_mission_id and status not in('complete','revoked')) then raise exception 'mission_has_unfinished_delegations';end if;
 update public.hq_workforce_command_missions set state='complete',evidence_hash=p_evidence_hash,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_mission_id;
 perform public.hq_workforce_command_append_event(p_mission_id,p_verifier_key,'mission.certified',jsonb_build_object('evidence_hash',p_evidence_hash));return jsonb_build_object('mission_id',p_mission_id,'state','complete','verifier_key',p_verifier_key);end$$;

revoke all on function public.hq_workforce_command_append_event(uuid,text,text,jsonb),public.hq_workforce_command_assert_delegation(uuid),public.hq_workforce_command_record_challenge(uuid,text,text,text,text,jsonb),public.hq_workforce_command_complete_mission(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_command_append_event(uuid,text,text,jsonb),public.hq_workforce_command_assert_delegation(uuid),public.hq_workforce_command_record_challenge(uuid,text,text,text,text,jsonb),public.hq_workforce_command_complete_mission(uuid,text,text) to service_role;

-- Command cannot activate runtime or mint authority.
do $$declare ec public.hq_workforce_engine_contract%rowtype;begin select * into ec from public.hq_workforce_engine_contract where singleton=true;if not found then raise exception 'command_kernel_requires_engine_contract';end if;
 if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'command_kernel_non_activating_boundary_violated';end if;end$$;
