-- WE-R1.3X X1 hardening: make Objective a governed, provenance-aware reasoning object.
-- Additive/non-activating. Existing R1.3X objective rows remain valid and are transparently marked as compatibility-inferred provenance.

alter table public.hq_workforce_objectives
  add column if not exists parent_objective_id uuid references public.hq_workforce_objectives(id) on delete restrict,
  add column if not exists source_type text,
  add column if not exists source_ref text,
  add column if not exists provenance jsonb not null default '{}'::jsonb,
  add column if not exists success_criteria jsonb not null default '[]'::jsonb,
  add column if not exists evidence_requirements jsonb not null default '[]'::jsonb,
  add column if not exists priority smallint not null default 50 check(priority between 0 and 100),
  add column if not exists sla_due_at timestamptz;

update public.hq_workforce_objectives
set source_type = coalesce(source_type,
      case when objective_key like 'shadow-candidate:%' then 'hq_work_item' else 'legacy_r13x_objective' end),
    source_ref = coalesce(source_ref,scope_key),
    provenance = case when provenance='{}'::jsonb then
      jsonb_build_object(
        'mode','compatibility_inferred',
        'source_type',case when objective_key like 'shadow-candidate:%' then 'hq_work_item' else 'legacy_r13x_objective' end,
        'source_ref',scope_key,
        'reason','Objective predates X1 provenance hardening; provenance is explicitly inferred rather than treated as authoritative.'
      ) else provenance end,
    success_criteria = case when success_criteria='[]'::jsonb and desired_outcome<>'{}'::jsonb then jsonb_build_array(desired_outcome) else success_criteria end,
    evidence_requirements = case when evidence_requirements='[]'::jsonb then '[{"kind":"verification","required":true}]'::jsonb else evidence_requirements end
where source_type is null or provenance='{}'::jsonb or success_criteria='[]'::jsonb or evidence_requirements='[]'::jsonb;

alter table public.hq_workforce_objectives
  alter column source_type set not null;

alter table public.hq_workforce_objectives
  drop constraint if exists hq_workforce_objectives_provenance_object,
  add constraint hq_workforce_objectives_provenance_object check(jsonb_typeof(provenance)='object' and provenance<>'{}'::jsonb),
  drop constraint if exists hq_workforce_objectives_success_criteria_array,
  add constraint hq_workforce_objectives_success_criteria_array check(jsonb_typeof(success_criteria)='array'),
  drop constraint if exists hq_workforce_objectives_evidence_requirements_array,
  add constraint hq_workforce_objectives_evidence_requirements_array check(jsonb_typeof(evidence_requirements)='array'),
  drop constraint if exists hq_workforce_objectives_parent_not_self,
  add constraint hq_workforce_objectives_parent_not_self check(parent_objective_id is null or parent_objective_id<>id);

create index if not exists hq_workforce_objectives_parent_idx on public.hq_workforce_objectives(parent_objective_id) where parent_objective_id is not null;
create index if not exists hq_workforce_objectives_priority_idx on public.hq_workforce_objectives(status,priority desc,created_at);
create index if not exists hq_workforce_objectives_source_idx on public.hq_workforce_objectives(source_type,source_ref);

create table if not exists public.hq_workforce_objective_events (
  id bigint generated always as identity primary key,
  objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
  event_kind text not null check(event_kind in ('detected','planning_started','planned','escalated','review_requested','reviewed','closed','relationship_added','correction')),
  from_status text,
  to_status text,
  reason text not null check(char_length(btrim(reason)) between 3 and 4000),
  evidence_refs jsonb not null default '[]'::jsonb check(jsonb_typeof(evidence_refs)='array'),
  payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_objective_events_objective_idx on public.hq_workforce_objective_events(objective_id,created_at,id);

create or replace function public.hq_workforce_objective_events_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  raise exception 'worker_engine_objective_history_is_append_only';
end $$;

drop trigger if exists trg_hq_workforce_objective_events_immutable on public.hq_workforce_objective_events;
create trigger trg_hq_workforce_objective_events_immutable
before update or delete on public.hq_workforce_objective_events
for each row execute function public.hq_workforce_objective_events_immutable();

-- Compatibility guard: old code paths may still insert objective rows directly. They may not create provenance-free objectives.
create or replace function public.hq_workforce_objective_insert_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.source_type is null then
    new.source_type := case when new.objective_key like 'shadow-candidate:%' then 'hq_work_item' else 'compatibility' end;
  end if;
  if new.source_ref is null then new.source_ref := new.scope_key; end if;
  if new.provenance='{}'::jsonb then
    new.provenance := jsonb_build_object('mode','compatibility_inferred','source_type',new.source_type,'source_ref',new.source_ref);
  end if;
  if new.evidence_requirements='[]'::jsonb then
    new.evidence_requirements := '[{"kind":"verification","required":true}]'::jsonb;
  end if;
  if new.success_criteria='[]'::jsonb and new.desired_outcome<>'{}'::jsonb then
    new.success_criteria := jsonb_build_array(new.desired_outcome);
  end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_objective_insert_guard on public.hq_workforce_objectives;
create trigger trg_hq_workforce_objective_insert_guard
before insert on public.hq_workforce_objectives
for each row execute function public.hq_workforce_objective_insert_guard();

create or replace function public.hq_workforce_objective_audit_trigger()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare k text;
begin
  if tg_op='INSERT' then
    insert into public.hq_workforce_objective_events(objective_id,event_kind,to_status,reason,payload)
    values(new.id,'detected',new.status,'Objective detected with provenance.',jsonb_build_object('source_type',new.source_type,'source_ref',new.source_ref));
    return new;
  end if;
  if old.status is distinct from new.status then
    k:=case new.status when 'planning' then 'planning_started' when 'planned' then 'planned' when 'escalated' then 'escalated' when 'closed' then 'closed' else 'correction' end;
    insert into public.hq_workforce_objective_events(objective_id,event_kind,from_status,to_status,reason,payload)
    values(new.id,k,old.status,new.status,'Objective lifecycle state changed.',jsonb_build_object('architecture','WE-R1.3X'));
  end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_objective_audit on public.hq_workforce_objectives;
create trigger trg_hq_workforce_objective_audit
after insert or update on public.hq_workforce_objectives
for each row execute function public.hq_workforce_objective_audit_trigger();

alter table public.hq_workforce_objective_events enable row level security;
revoke all on table public.hq_workforce_objective_events from public,anon,authenticated;
grant select,insert on table public.hq_workforce_objective_events to service_role;
grant usage,select on sequence public.hq_workforce_objective_events_id_seq to service_role;

revoke all on function public.hq_workforce_objective_events_immutable(),public.hq_workforce_objective_insert_guard(),public.hq_workforce_objective_audit_trigger() from public,anon,authenticated;

-- X1 remains L0 and cannot activate old or consequential runtime controls.
do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then
    raise exception 'WE-R1.3X X1 objective hardening violated L0 boundary';
  end if;
end $$;
