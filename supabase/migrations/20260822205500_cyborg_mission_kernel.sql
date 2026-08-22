begin;

create table if not exists public.hq_cyborg_missions (
  id uuid primary key default gen_random_uuid(), objective text not null,
  state text not null check (state in ('received','investigating','planned','executing','verifying','repairing','certifying','complete','blocked','aborted')),
  base_revision text not null, success_criteria jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '[]'::jsonb, owner_gates jsonb not null default '[]'::jsonb,
  forbidden_actions jsonb not null default '[]'::jsonb, mission jsonb not null, checkpoint text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  cycle integer not null default 0 check (cycle >= 0), no_progress_cycles integer not null default 0 check (no_progress_cycles >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.hq_cyborg_mission_events (
  id bigint generated always as identity primary key, mission_id uuid not null references public.hq_cyborg_missions(id),
  event_type text not null, payload jsonb not null default '{}'::jsonb, evidence_hash text not null, created_at timestamptz not null default now()
);
create table if not exists public.hq_cyborg_mission_leases (
  mission_id uuid primary key references public.hq_cyborg_missions(id), holder text not null, base_revision text not null,
  acquired_at timestamptz not null default now(), expires_at timestamptz not null, generation bigint not null default 1 check (generation > 0)
);
create table if not exists public.hq_cyborg_slo_events (
  id bigint generated always as identity primary key, mission_id uuid references public.hq_cyborg_missions(id),
  metric text not null check (metric in ('false_complete','unauthorized_action','stale_evidence','recovery','regression_leakage','idempotency_violation','completion_accuracy','tool_failure','model_replacement')),
  value numeric not null, dimensions jsonb not null default '{}'::jsonb, observed_at timestamptz not null default now()
);
create unique index if not exists hq_cyborg_event_dedupe on public.hq_cyborg_mission_events(mission_id,event_type,evidence_hash);
create index if not exists hq_cyborg_slo_metric_time on public.hq_cyborg_slo_events(metric,observed_at desc);

alter table public.hq_cyborg_missions enable row level security;
alter table public.hq_cyborg_mission_events enable row level security;
alter table public.hq_cyborg_mission_leases enable row level security;
alter table public.hq_cyborg_slo_events enable row level security;
revoke all on public.hq_cyborg_missions, public.hq_cyborg_mission_events, public.hq_cyborg_mission_leases, public.hq_cyborg_slo_events from anon, authenticated;
grant select,insert,update on public.hq_cyborg_missions to service_role;
grant select,insert on public.hq_cyborg_mission_events to service_role;
grant select,insert,update,delete on public.hq_cyborg_mission_leases to service_role;
grant select,insert on public.hq_cyborg_slo_events to service_role;
grant usage,select on sequence public.hq_cyborg_mission_events_id_seq, public.hq_cyborg_slo_events_id_seq to service_role;

create or replace function public.hq_cyborg_acquire_lease(p_mission_id uuid,p_holder text,p_base_revision text,p_ttl_seconds integer default 900)
returns public.hq_cyborg_mission_leases language plpgsql security invoker set search_path=public as $$
declare v public.hq_cyborg_mission_leases;
begin
  if p_ttl_seconds < 30 or p_ttl_seconds > 3600 then raise exception 'INVALID_LEASE_TTL'; end if;
  select * into v from public.hq_cyborg_mission_leases where mission_id=p_mission_id for update;
  if found and v.expires_at > now() and v.holder <> p_holder then raise exception 'MISSION_LEASE_HELD'; end if;
  insert into public.hq_cyborg_mission_leases(mission_id,holder,base_revision,acquired_at,expires_at,generation)
  values(p_mission_id,p_holder,p_base_revision,now(),now()+make_interval(secs=>p_ttl_seconds),coalesce(v.generation,0)+1)
  on conflict(mission_id) do update set holder=excluded.holder,base_revision=excluded.base_revision,acquired_at=excluded.acquired_at,expires_at=excluded.expires_at,generation=public.hq_cyborg_mission_leases.generation+1
  returning * into v; return v;
end $$;
create or replace function public.hq_cyborg_append_event(p_mission_id uuid,p_event_type text,p_payload jsonb,p_evidence_hash text)
returns bigint language plpgsql security invoker set search_path=public as $$
declare v_id bigint;
begin
  insert into public.hq_cyborg_mission_events(mission_id,event_type,payload,evidence_hash)
  values(p_mission_id,p_event_type,coalesce(p_payload,'{}'::jsonb),p_evidence_hash)
  on conflict(mission_id,event_type,evidence_hash) do update set payload=public.hq_cyborg_mission_events.payload
  returning id into v_id; return v_id;
end $$;
revoke all on function public.hq_cyborg_acquire_lease(uuid,text,text,integer), public.hq_cyborg_append_event(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.hq_cyborg_acquire_lease(uuid,text,text,integer), public.hq_cyborg_append_event(uuid,text,jsonb,text) to service_role;
commit;
