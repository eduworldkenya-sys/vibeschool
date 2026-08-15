-- WE-R1.3X X1: additive Objective Kernel.
-- NON-ACTIVATING: does not enable heartbeat, Factory, Shadow scheduler, runtime execution or autonomy.
-- Objective is the canonical reasoning object above plans/jobs; this migration deliberately does not change existing routing/scheduler behavior.
-- Access declarations are machine-checked by scripts/validate-supabase-migration-contract.py.
-- access: service-only public.hq_workforce_objectives
-- authorization-test: public.hq_workforce_objectives (supabase/tests/worker_engine_we_r1_3x_objective_kernel.sql verifies anon/authenticated have no direct table privileges)
-- access: service-only public.hq_workforce_objective_work_items
-- authorization-test: public.hq_workforce_objective_work_items (service-only bridge; direct product roles are revoked)
-- access: service-only public.hq_workforce_objective_events
-- authorization-test: public.hq_workforce_objective_events (service-only append-only evidence; direct product roles are revoked)

create table if not exists public.hq_workforce_objectives (
  id uuid primary key default gen_random_uuid(),
  objective_key text not null unique,
  parent_objective_id uuid references public.hq_workforce_objectives(id) on delete restrict,
  source_type text not null,
  source_ref text,
  desired_outcome text not null check (char_length(btrim(desired_outcome)) between 3 and 4000),
  scope_type text not null default 'platform_internal',
  scope_ref jsonb not null default '{}'::jsonb check (jsonb_typeof(scope_ref)='object'),
  constraints jsonb not null default '[]'::jsonb check (jsonb_typeof(constraints)='array'),
  success_criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(success_criteria)='array'),
  evidence_requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_requirements)='array'),
  priority smallint not null default 50 check (priority between 0 and 100),
  risk_class smallint not null default 0 check (risk_class between 0 and 5),
  sla_due_at timestamptz,
  status text not null default 'detected' check (status in ('detected','context_pending','planning','shadow_ready','awaiting_review','approved','rejected','blocked','achieved','cancelled')),
  provenance jsonb not null check (jsonb_typeof(provenance)='object'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  achieved_at timestamptz,
  cancelled_at timestamptz,
  check (parent_objective_id is null or parent_objective_id <> id),
  check ((status='achieved') = (achieved_at is not null)),
  check ((status='cancelled') = (cancelled_at is not null))
);

create index if not exists hq_workforce_objectives_status_idx
  on public.hq_workforce_objectives(status, priority desc, created_at);
create index if not exists hq_workforce_objectives_parent_idx
  on public.hq_workforce_objectives(parent_objective_id) where parent_objective_id is not null;
create index if not exists hq_workforce_objectives_source_idx
  on public.hq_workforce_objectives(source_type, source_ref);

create table if not exists public.hq_workforce_objective_work_items (
  objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
  work_item_id uuid not null references public.hq_work_items(id) on delete restrict,
  relationship text not null default 'source' check (relationship in ('source','derived_job','evidence','verification')),
  created_at timestamptz not null default clock_timestamp(),
  primary key(objective_id, work_item_id, relationship)
);
create index if not exists hq_workforce_objective_work_items_work_idx
  on public.hq_workforce_objective_work_items(work_item_id, objective_id);

create table if not exists public.hq_workforce_objective_events (
  id bigint generated always as identity primary key,
  objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
  event_kind text not null check (event_kind in ('detected','context_requested','planning_started','shadow_ready','review_requested','approved','rejected','blocked','achieved','cancelled','relationship_added','correction')),
  from_status text,
  to_status text,
  actor_type text not null default 'system' check (actor_type in ('system','worker','human')),
  actor_ref text,
  reason text not null check (char_length(btrim(reason)) between 3 and 4000),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_objective_events_objective_idx
  on public.hq_workforce_objective_events(objective_id, created_at);

create or replace function public.hq_workforce_objective_events_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  raise exception 'worker_engine_objective_history_is_append_only';
end $$;

drop trigger if exists trg_hq_workforce_objective_events_immutable on public.hq_workforce_objective_events;
create trigger trg_hq_workforce_objective_events_immutable
before update or delete on public.hq_workforce_objective_events
for each row execute function public.hq_workforce_objective_events_immutable();

create or replace function public.hq_workforce_create_objective(
  p_objective_key text,p_source_type text,p_source_ref text,p_desired_outcome text,p_scope_type text,p_scope_ref jsonb,
  p_constraints jsonb,p_success_criteria jsonb,p_evidence_requirements jsonb,p_priority smallint,p_risk_class smallint,
  p_sla_due_at timestamptz,p_provenance jsonb,p_parent_objective_id uuid default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if char_length(btrim(coalesce(p_objective_key,''))) not between 3 and 200 then raise exception 'objective_key_invalid'; end if;
  if char_length(btrim(coalesce(p_source_type,''))) not between 1 and 100 then raise exception 'objective_source_type_invalid'; end if;
  if char_length(btrim(coalesce(p_desired_outcome,''))) not between 3 and 4000 then raise exception 'objective_outcome_invalid'; end if;
  if coalesce(jsonb_typeof(p_scope_ref),'null') <> 'object' then raise exception 'objective_scope_ref_invalid'; end if;
  if coalesce(jsonb_typeof(p_constraints),'null') <> 'array' then raise exception 'objective_constraints_invalid'; end if;
  if coalesce(jsonb_typeof(p_success_criteria),'null') <> 'array' then raise exception 'objective_success_criteria_invalid'; end if;
  if coalesce(jsonb_typeof(p_evidence_requirements),'null') <> 'array' then raise exception 'objective_evidence_requirements_invalid'; end if;
  if coalesce(jsonb_typeof(p_provenance),'null') <> 'object' or p_provenance='{}'::jsonb then raise exception 'objective_provenance_required'; end if;
  if p_priority not between 0 and 100 then raise exception 'objective_priority_invalid'; end if;
  if p_risk_class not between 0 and 5 then raise exception 'objective_risk_invalid'; end if;
  if p_parent_objective_id is not null and not exists(select 1 from public.hq_workforce_objectives where id=p_parent_objective_id) then raise exception 'parent_objective_not_found'; end if;
  insert into public.hq_workforce_objectives(objective_key,parent_objective_id,source_type,source_ref,desired_outcome,scope_type,scope_ref,constraints,success_criteria,evidence_requirements,priority,risk_class,sla_due_at,provenance)
  values(btrim(p_objective_key),p_parent_objective_id,btrim(p_source_type),nullif(btrim(coalesce(p_source_ref,'')),''),btrim(p_desired_outcome),coalesce(nullif(btrim(p_scope_type),''),'platform_internal'),p_scope_ref,p_constraints,p_success_criteria,p_evidence_requirements,p_priority,p_risk_class,p_sla_due_at,p_provenance)
  returning id into v_id;
  insert into public.hq_workforce_objective_events(objective_id,event_kind,to_status,reason,payload)
  values(v_id,'detected','detected','Objective created with explicit provenance.',jsonb_build_object('source_type',p_source_type,'source_ref',p_source_ref));
  return v_id;
end $$;

create or replace function public.hq_workforce_link_objective_work_item(p_objective_id uuid,p_work_item_id uuid,p_relationship text default 'source')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_relationship not in ('source','derived_job','evidence','verification') then raise exception 'objective_work_relationship_invalid'; end if;
  if not exists(select 1 from public.hq_workforce_objectives where id=p_objective_id) then raise exception 'objective_not_found'; end if;
  if not exists(select 1 from public.hq_work_items where id=p_work_item_id) then raise exception 'work_item_not_found'; end if;
  insert into public.hq_workforce_objective_work_items(objective_id,work_item_id,relationship) values(p_objective_id,p_work_item_id,p_relationship) on conflict do nothing;
  insert into public.hq_workforce_objective_events(objective_id,event_kind,reason,payload)
  values(p_objective_id,'relationship_added','Existing work item linked without changing its lifecycle.',jsonb_build_object('work_item_id',p_work_item_id,'relationship',p_relationship));
end $$;

create or replace function public.hq_workforce_transition_objective(p_objective_id uuid,p_to_status text,p_reason text,p_actor_type text default 'system',p_actor_ref text default null,p_evidence_refs jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.hq_workforce_objectives%rowtype; v_allowed boolean:=false; v_event text;
begin
  if p_actor_type not in ('system','worker','human') then raise exception 'objective_actor_type_invalid'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 4000 then raise exception 'objective_transition_reason_required'; end if;
  if coalesce(jsonb_typeof(p_evidence_refs),'null') <> 'array' then raise exception 'objective_evidence_refs_invalid'; end if;
  select * into o from public.hq_workforce_objectives where id=p_objective_id for update;
  if not found then raise exception 'objective_not_found'; end if;
  if o.status in ('achieved','cancelled','rejected') then raise exception 'objective_terminal_state'; end if;
  v_allowed := case o.status
    when 'detected' then p_to_status in ('context_pending','planning','blocked','cancelled')
    when 'context_pending' then p_to_status in ('planning','blocked','cancelled')
    when 'planning' then p_to_status in ('shadow_ready','blocked','cancelled')
    when 'shadow_ready' then p_to_status in ('awaiting_review','blocked','cancelled')
    when 'awaiting_review' then p_to_status in ('approved','rejected','blocked','cancelled')
    when 'approved' then p_to_status in ('achieved','blocked','cancelled')
    when 'blocked' then p_to_status in ('context_pending','planning','cancelled') else false end;
  if not v_allowed then raise exception 'objective_transition_invalid:%->%',o.status,p_to_status; end if;
  if p_to_status='achieved' and jsonb_array_length(p_evidence_refs)=0 then raise exception 'objective_achievement_requires_evidence'; end if;
  v_event := case p_to_status when 'context_pending' then 'context_requested' when 'planning' then 'planning_started' when 'shadow_ready' then 'shadow_ready' when 'awaiting_review' then 'review_requested' when 'approved' then 'approved' when 'rejected' then 'rejected' when 'blocked' then 'blocked' when 'achieved' then 'achieved' when 'cancelled' then 'cancelled' else 'correction' end;
  update public.hq_workforce_objectives set status=p_to_status,updated_at=clock_timestamp(),achieved_at=case when p_to_status='achieved' then clock_timestamp() else null end,cancelled_at=case when p_to_status='cancelled' then clock_timestamp() else null end where id=p_objective_id;
  insert into public.hq_workforce_objective_events(objective_id,event_kind,from_status,to_status,actor_type,actor_ref,reason,evidence_refs)
  values(p_objective_id,v_event,o.status,p_to_status,p_actor_type,p_actor_ref,btrim(p_reason),p_evidence_refs);
  return jsonb_build_object('objective_id',p_objective_id,'from_status',o.status,'to_status',p_to_status,'consequential_execution',false);
end $$;

alter table public.hq_workforce_objectives enable row level security;
alter table public.hq_workforce_objective_work_items enable row level security;
alter table public.hq_workforce_objective_events enable row level security;
revoke all on table public.hq_workforce_objectives from public,anon,authenticated;
revoke all on table public.hq_workforce_objective_work_items from public,anon,authenticated;
revoke all on table public.hq_workforce_objective_events from public,anon,authenticated;
grant select,insert,update on table public.hq_workforce_objectives to service_role;
grant select,insert on table public.hq_workforce_objective_work_items to service_role;
grant select,insert on table public.hq_workforce_objective_events to service_role;
grant usage,select on sequence public.hq_workforce_objective_events_id_seq to service_role;
revoke all on function public.hq_workforce_objective_events_immutable() from public,anon,authenticated;
revoke all on function public.hq_workforce_create_objective(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,smallint,smallint,timestamptz,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_link_objective_work_item(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_transition_objective(uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_create_objective(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,smallint,smallint,timestamptz,jsonb,uuid) to service_role;
grant execute on function public.hq_workforce_link_objective_work_item(uuid,uuid,text) to service_role;
grant execute on function public.hq_workforce_transition_objective(uuid,text,text,text,text,jsonb) to service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.3X X1 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'WE-R1.3X X1 violated fail-closed runtime boundary'; end if;
end $$;
