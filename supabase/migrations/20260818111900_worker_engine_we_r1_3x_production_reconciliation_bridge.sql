-- WE-R1.3X production reconciliation bridge.
-- IMPORTANT: production already records X1 (20260815080000) and X2 (20260815090000)
-- as applied, but the pre-X legacy objective/plan tables survived because X1/X2 used
-- conditional table creation against incompatible existing names. This bridge sits after X2 and
-- before X3 so an --include-all production upgrade converges to the canonical X1/X2
-- schema before later R1.3X/R1.4 migrations execute.
--
-- NON-ACTIVATING: no runtime, heartbeat, Factory, Shadow scheduler, authority or cron
-- activation is permitted here. Legacy rows are preserved losslessly in a private
-- archive schema; they are deliberately NOT auto-promoted into canonical objectives.
-- access: service-only public.hq_workforce_objectives
-- authorization-test: public.hq_workforce_objectives denies public/anon/authenticated direct access; service access is explicitly declared below.
-- access: service-only public.hq_workforce_objective_work_items
-- authorization-test: public.hq_workforce_objective_work_items denies public/anon/authenticated direct access; service access is explicitly declared below.
-- access: service-only public.hq_workforce_objective_events
-- authorization-test: public.hq_workforce_objective_events denies public/anon/authenticated direct access and remains append-only.
-- access: service-only public.hq_workforce_objective_context
-- authorization-test: public.hq_workforce_objective_context denies public/anon/authenticated direct access; service access is explicitly declared below.

create schema if not exists worker_engine_legacy_archive;
revoke all on schema worker_engine_legacy_archive from public,anon,authenticated,service_role;

do $$
declare v_legacy boolean; r record;
begin
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_objectives' and column_name='trace_id') into v_legacy;
  if not v_legacy then return; end if;
  for r in select unnest(array[
    'hq_workforce_objective_context','hq_workforce_objective_events','hq_workforce_objective_work_items',
    'hq_workforce_plan_step_dependencies','hq_workforce_plan_steps','hq_workforce_plans','hq_workforce_objectives'
  ]) as relname loop
    if to_regclass('public.'||r.relname) is not null then execute format('alter table public.%I set schema worker_engine_legacy_archive',r.relname); end if;
  end loop;
end $$;

create table if not exists public.hq_workforce_objectives (
  id uuid primary key default gen_random_uuid(), objective_key text not null unique,
  parent_objective_id uuid references public.hq_workforce_objectives(id) on delete restrict,
  source_type text not null, source_ref text,
  desired_outcome text not null check (char_length(btrim(desired_outcome)) between 3 and 4000),
  scope_type text not null default 'platform_internal', scope_ref jsonb not null default '{}'::jsonb check (jsonb_typeof(scope_ref)='object'),
  constraints jsonb not null default '[]'::jsonb check (jsonb_typeof(constraints)='array'),
  success_criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(success_criteria)='array'),
  evidence_requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_requirements)='array'),
  priority smallint not null default 50 check (priority between 0 and 100), risk_class smallint not null default 0 check (risk_class between 0 and 5),
  sla_due_at timestamptz,
  status text not null default 'detected' check (status in ('detected','context_pending','planning','shadow_ready','awaiting_review','approved','rejected','blocked','achieved','cancelled')),
  provenance jsonb not null check (jsonb_typeof(provenance)='object'), created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  achieved_at timestamptz, cancelled_at timestamptz,
  check (parent_objective_id is null or parent_objective_id <> id), check ((status='achieved') = (achieved_at is not null)), check ((status='cancelled') = (cancelled_at is not null))
);
create index if not exists hq_workforce_objectives_status_idx on public.hq_workforce_objectives(status,priority desc,created_at);
create index if not exists hq_workforce_objectives_parent_idx on public.hq_workforce_objectives(parent_objective_id) where parent_objective_id is not null;
create index if not exists hq_workforce_objectives_source_idx on public.hq_workforce_objectives(source_type,source_ref);

create table if not exists public.hq_workforce_objective_work_items (
  objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
  work_item_id uuid not null references public.hq_work_items(id) on delete restrict,
  relationship text not null default 'source' check (relationship in ('source','derived_job','evidence','verification')),
  created_at timestamptz not null default clock_timestamp(), primary key(objective_id,work_item_id,relationship)
);
create index if not exists hq_workforce_objective_work_items_work_idx on public.hq_workforce_objective_work_items(work_item_id,objective_id);

create table if not exists public.hq_workforce_objective_events (
  id bigint generated always as identity primary key, objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
  event_kind text not null check (event_kind in ('detected','context_requested','planning_started','shadow_ready','review_requested','approved','rejected','blocked','achieved','cancelled','relationship_added','correction')),
  from_status text,to_status text,actor_type text not null default 'system' check (actor_type in ('system','worker','human')),actor_ref text,
  reason text not null check (char_length(btrim(reason)) between 3 and 4000), evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'), created_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_objective_events_objective_idx on public.hq_workforce_objective_events(objective_id,created_at);
drop trigger if exists trg_hq_workforce_objective_events_immutable on public.hq_workforce_objective_events;
create trigger trg_hq_workforce_objective_events_immutable before update or delete on public.hq_workforce_objective_events for each row execute function public.hq_workforce_objective_events_immutable();

create table if not exists public.hq_workforce_objective_context (
  objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
  memory_id uuid not null references public.hq_workforce_memory_records(id) on delete restrict,
  context_role text not null check (context_role in ('required','supporting','constraint','policy','risk','verification')),
  selected_reason text not null check (char_length(btrim(selected_reason)) between 3 and 2000),
  required_freshness_seconds bigint check (required_freshness_seconds is null or required_freshness_seconds >= 0), selected_at timestamptz not null default clock_timestamp(),
  primary key(objective_id,memory_id,context_role)
);
create index if not exists hq_workforce_objective_context_objective_idx on public.hq_workforce_objective_context(objective_id,context_role,selected_at);

alter table public.hq_workforce_objectives enable row level security;
alter table public.hq_workforce_objective_work_items enable row level security;
alter table public.hq_workforce_objective_events enable row level security;
alter table public.hq_workforce_objective_context enable row level security;
revoke all on table public.hq_workforce_objectives from public,anon,authenticated,service_role;
revoke all on table public.hq_workforce_objective_work_items from public,anon,authenticated,service_role;
revoke all on table public.hq_workforce_objective_events from public,anon,authenticated,service_role;
revoke all on table public.hq_workforce_objective_context from public,anon,authenticated,service_role;
grant select,insert,update on table public.hq_workforce_objectives to service_role;
grant select,insert on table public.hq_workforce_objective_work_items to service_role;
grant select,insert on table public.hq_workforce_objective_events to service_role;
grant select,insert,update on table public.hq_workforce_objective_context to service_role;
grant usage,select on sequence public.hq_workforce_objective_events_id_seq to service_role;
revoke all on all tables in schema worker_engine_legacy_archive from public,anon,authenticated,service_role;
revoke all on all sequences in schema worker_engine_legacy_archive from public,anon,authenticated,service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_type text;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'production_reconciliation_requires_engine_contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'production_reconciliation_violated_fail_closed_boundary'; end if;
  select data_type into v_type from information_schema.columns where table_schema='public' and table_name='hq_workforce_objectives' and column_name='desired_outcome';
  if v_type is distinct from 'text' then raise exception 'production_reconciliation_objective_shape_failed:%',v_type; end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='hq_workforce_objectives' and column_name='trace_id') then raise exception 'production_reconciliation_legacy_objective_still_canonical'; end if;
  if to_regclass('public.hq_workforce_objective_context') is null then raise exception 'production_reconciliation_context_missing'; end if;
end $$;
