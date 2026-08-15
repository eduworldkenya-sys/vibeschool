-- WE-R1.3X X2: governed Memory and Context Fabric.
-- NON-ACTIVATING: no heartbeat, Factory, runtime execution or autonomy changes.
-- access: service-only public.hq_workforce_memory_records
-- authorization-test: public.hq_workforce_memory_records denies anon/authenticated direct access; service_role manages governed institutional memory only.
-- access: service-only public.hq_workforce_objective_context
-- authorization-test: public.hq_workforce_objective_context denies anon/authenticated direct access; service_role binds governed memory to objectives only.
-- access: service-only public.hq_workforce_memory_events
-- authorization-test: public.hq_workforce_memory_events denies anon/authenticated direct access; service_role appends provenance/audit events only.

create table if not exists public.hq_workforce_memory_records (
  id uuid primary key default gen_random_uuid(),
  memory_key text not null,
  version integer not null default 1 check (version > 0),
  memory_type text not null check (memory_type in ('fact','observation','hypothesis','policy','decision','outcome','lesson','failure')),
  content jsonb not null check (jsonb_typeof(content)='object'),
  provenance jsonb not null check (jsonb_typeof(provenance)='object' and provenance <> '{}'::jsonb),
  source_kind text not null,
  source_ref text,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  verification_state text not null default 'unverified' check (verification_state in ('unverified','corroborated','verified','disputed','superseded','revoked')),
  authoritative boolean not null default false,
  scope_type text not null default 'platform_internal',
  scope_ref jsonb not null default '{}'::jsonb check (jsonb_typeof(scope_ref)='object'),
  data_classifications text[] not null default array['internal']::text[],
  jurisdictions text[] not null default array['global']::text[],
  valid_from timestamptz not null default clock_timestamp(),
  valid_until timestamptz,
  observed_at timestamptz,
  supersedes_id uuid references public.hq_workforce_memory_records(id) on delete restrict,
  contradiction_group text,
  retention_until timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(memory_key, version),
  check (valid_until is null or valid_until > valid_from),
  check (not authoritative or verification_state='verified'),
  check (memory_type <> 'hypothesis' or not authoritative)
);

create index if not exists hq_workforce_memory_records_lookup_idx
  on public.hq_workforce_memory_records(memory_key,scope_type,verification_state,authoritative,version desc);
create index if not exists hq_workforce_memory_records_contradiction_idx
  on public.hq_workforce_memory_records(contradiction_group) where contradiction_group is not null;

create table if not exists public.hq_workforce_objective_context (
  objective_id uuid not null references public.hq_workforce_objectives(id) on delete restrict,
  memory_id uuid not null references public.hq_workforce_memory_records(id) on delete restrict,
  context_role text not null check (context_role in ('required','supporting','constraint','policy','risk','verification')),
  selected_reason text not null check (char_length(btrim(selected_reason)) between 3 and 2000),
  required_freshness_seconds bigint check (required_freshness_seconds is null or required_freshness_seconds >= 0),
  selected_at timestamptz not null default clock_timestamp(),
  primary key(objective_id,memory_id,context_role)
);
create index if not exists hq_workforce_objective_context_objective_idx
  on public.hq_workforce_objective_context(objective_id,context_role,selected_at);

create table if not exists public.hq_workforce_memory_events (
  id bigint generated always as identity primary key,
  memory_id uuid not null references public.hq_workforce_memory_records(id) on delete restrict,
  event_kind text not null check (event_kind in ('created','verified','disputed','superseded','revoked','bound_to_objective','recalled','correction')),
  actor_type text not null default 'system' check (actor_type in ('system','worker','human')),
  actor_ref text,
  reason text not null check (char_length(btrim(reason)) between 3 and 4000),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists hq_workforce_memory_events_memory_idx on public.hq_workforce_memory_events(memory_id,created_at);

create or replace function public.hq_workforce_memory_events_immutable()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  raise exception 'worker_engine_memory_history_is_append_only';
end $$;

drop trigger if exists trg_hq_workforce_memory_events_immutable on public.hq_workforce_memory_events;
create trigger trg_hq_workforce_memory_events_immutable
before update or delete on public.hq_workforce_memory_events
for each row execute function public.hq_workforce_memory_events_immutable();

create or replace function public.hq_workforce_add_memory(
  p_memory_key text,
  p_memory_type text,
  p_content jsonb,
  p_provenance jsonb,
  p_source_kind text,
  p_source_ref text,
  p_confidence numeric,
  p_verification_state text default 'unverified',
  p_authoritative boolean default false,
  p_scope_type text default 'platform_internal',
  p_scope_ref jsonb default '{}'::jsonb,
  p_data_classifications text[] default array['internal']::text[],
  p_jurisdictions text[] default array['global']::text[],
  p_valid_from timestamptz default clock_timestamp(),
  p_valid_until timestamptz default null,
  p_observed_at timestamptz default null,
  p_supersedes_id uuid default null,
  p_contradiction_group text default null,
  p_retention_until timestamptz default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_id uuid;
  v_version integer;
begin
  if char_length(btrim(coalesce(p_memory_key,''))) not between 3 and 300 then raise exception 'memory_key_invalid'; end if;
  if p_memory_type not in ('fact','observation','hypothesis','policy','decision','outcome','lesson','failure') then raise exception 'memory_type_invalid'; end if;
  if coalesce(jsonb_typeof(p_content),'null') <> 'object' then raise exception 'memory_content_invalid'; end if;
  if coalesce(jsonb_typeof(p_provenance),'null') <> 'object' or p_provenance='{}'::jsonb then raise exception 'memory_provenance_required'; end if;
  if char_length(btrim(coalesce(p_source_kind,''))) < 1 then raise exception 'memory_source_kind_required'; end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 1 then raise exception 'memory_confidence_invalid'; end if;
  if p_authoritative and p_verification_state <> 'verified' then raise exception 'authoritative_memory_requires_verified_state'; end if;
  if p_memory_type='hypothesis' and p_authoritative then raise exception 'hypothesis_cannot_be_authoritative'; end if;
  if coalesce(jsonb_typeof(p_scope_ref),'null') <> 'object' then raise exception 'memory_scope_invalid'; end if;
  if p_valid_until is not null and p_valid_until <= p_valid_from then raise exception 'memory_validity_invalid'; end if;
  if p_supersedes_id is not null and not exists(select 1 from public.hq_workforce_memory_records where id=p_supersedes_id) then raise exception 'memory_supersedes_not_found'; end if;

  select coalesce(max(version),0)+1 into v_version from public.hq_workforce_memory_records where memory_key=btrim(p_memory_key);

  insert into public.hq_workforce_memory_records(
    memory_key,version,memory_type,content,provenance,source_kind,source_ref,confidence,verification_state,authoritative,
    scope_type,scope_ref,data_classifications,jurisdictions,valid_from,valid_until,observed_at,supersedes_id,contradiction_group,retention_until
  ) values(
    btrim(p_memory_key),v_version,p_memory_type,p_content,p_provenance,btrim(p_source_kind),nullif(btrim(coalesce(p_source_ref,'')),''),
    p_confidence,p_verification_state,p_authoritative,coalesce(nullif(btrim(p_scope_type),''),'platform_internal'),p_scope_ref,
    coalesce(p_data_classifications,array['internal']::text[]),coalesce(p_jurisdictions,array['global']::text[]),p_valid_from,p_valid_until,p_observed_at,p_supersedes_id,
    nullif(btrim(coalesce(p_contradiction_group,'')),''),p_retention_until
  ) returning id into v_id;

  if p_supersedes_id is not null then
    update public.hq_workforce_memory_records set verification_state='superseded', authoritative=false where id=p_supersedes_id and verification_state<>'revoked';
    insert into public.hq_workforce_memory_events(memory_id,event_kind,reason,payload)
    values(p_supersedes_id,'superseded','Memory superseded by a newer governed version.',jsonb_build_object('successor_memory_id',v_id));
  end if;

  insert into public.hq_workforce_memory_events(memory_id,event_kind,reason,payload)
  values(v_id,'created','Governed memory created with explicit provenance.',jsonb_build_object('memory_key',p_memory_key,'version',v_version,'verification_state',p_verification_state));
  return v_id;
end $$;

create or replace function public.hq_workforce_bind_objective_context(
  p_objective_id uuid,
  p_memory_id uuid,
  p_context_role text,
  p_selected_reason text,
  p_required_freshness_seconds bigint default null
) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.hq_workforce_memory_records%rowtype;
begin
  if not exists(select 1 from public.hq_workforce_objectives where id=p_objective_id) then raise exception 'objective_not_found'; end if;
  if p_context_role not in ('required','supporting','constraint','policy','risk','verification') then raise exception 'objective_context_role_invalid'; end if;
  if char_length(btrim(coalesce(p_selected_reason,''))) not between 3 and 2000 then raise exception 'objective_context_reason_required'; end if;
  if p_required_freshness_seconds is not null and p_required_freshness_seconds < 0 then raise exception 'objective_context_freshness_invalid'; end if;
  select * into m from public.hq_workforce_memory_records where id=p_memory_id;
  if not found then raise exception 'memory_not_found'; end if;
  if m.verification_state in ('superseded','revoked') then raise exception 'memory_not_usable:%',m.verification_state; end if;
  if m.valid_until is not null and m.valid_until<=clock_timestamp() then raise exception 'memory_stale'; end if;
  if p_required_freshness_seconds is not null and coalesce(m.observed_at,m.created_at) < clock_timestamp()-make_interval(secs=>p_required_freshness_seconds::double precision) then raise exception 'memory_freshness_requirement_failed'; end if;
  if m.contradiction_group is not null and exists(
    select 1 from public.hq_workforce_memory_records x
    where x.id<>m.id and x.contradiction_group=m.contradiction_group and x.verification_state not in ('superseded','revoked')
      and (x.valid_until is null or x.valid_until>clock_timestamp())
  ) then raise exception 'memory_contradiction_unresolved'; end if;

  insert into public.hq_workforce_objective_context(objective_id,memory_id,context_role,selected_reason,required_freshness_seconds)
  values(p_objective_id,p_memory_id,p_context_role,btrim(p_selected_reason),p_required_freshness_seconds)
  on conflict do update set selected_reason=excluded.selected_reason,required_freshness_seconds=excluded.required_freshness_seconds,selected_at=clock_timestamp();

  insert into public.hq_workforce_memory_events(memory_id,event_kind,reason,payload)
  values(p_memory_id,'bound_to_objective','Memory selected as governed objective context.',jsonb_build_object('objective_id',p_objective_id,'context_role',p_context_role));
end $$;

create or replace function public.hq_workforce_recall_context(
  p_memory_key text,
  p_scope_type text default 'platform_internal',
  p_jurisdiction text default 'global',
  p_limit integer default 20
) returns table(
  memory_id uuid,version integer,memory_type text,content jsonb,confidence numeric,verification_state text,authoritative boolean,
  stale boolean,contradictory boolean,source_kind text,source_ref text,valid_from timestamptz,valid_until timestamptz
)
language sql security definer set search_path=public,pg_temp stable as $$
  select m.id,m.version,m.memory_type,m.content,m.confidence,m.verification_state,m.authoritative,
         (m.valid_until is not null and m.valid_until<=clock_timestamp()) as stale,
         (m.contradiction_group is not null and exists(
            select 1 from public.hq_workforce_memory_records x
            where x.id<>m.id and x.contradiction_group=m.contradiction_group and x.verification_state not in ('superseded','revoked')
              and (x.valid_until is null or x.valid_until>clock_timestamp())
          )) as contradictory,
         m.source_kind,m.source_ref,m.valid_from,m.valid_until
  from public.hq_workforce_memory_records m
  where m.memory_key=p_memory_key
    and m.scope_type in (p_scope_type,'global')
    and (p_jurisdiction=any(m.jurisdictions) or 'global'=any(m.jurisdictions))
    and m.verification_state<>'revoked'
  order by m.authoritative desc,
           (m.verification_state='verified') desc,
           (m.valid_until is null or m.valid_until>clock_timestamp()) desc,
           m.version desc
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;

alter table public.hq_workforce_memory_records enable row level security;
alter table public.hq_workforce_objective_context enable row level security;
alter table public.hq_workforce_memory_events enable row level security;
revoke all on table public.hq_workforce_memory_records from public,anon,authenticated;
revoke all on table public.hq_workforce_objective_context from public,anon,authenticated;
revoke all on table public.hq_workforce_memory_events from public,anon,authenticated;
grant select,insert,update on table public.hq_workforce_memory_records to service_role;
grant select,insert,update on table public.hq_workforce_objective_context to service_role;
grant select,insert on table public.hq_workforce_memory_events to service_role;
grant usage,select on sequence public.hq_workforce_memory_events_id_seq to service_role;
revoke all on function public.hq_workforce_memory_events_immutable() from public,anon,authenticated;
revoke all on function public.hq_workforce_add_memory(text,text,jsonb,jsonb,text,text,numeric,text,boolean,text,jsonb,text[],text[],timestamptz,timestamptz,timestamptz,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.hq_workforce_bind_objective_context(uuid,uuid,text,text,bigint) from public,anon,authenticated;
revoke all on function public.hq_workforce_recall_context(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_add_memory(text,text,jsonb,jsonb,text,text,numeric,text,boolean,text,jsonb,text[],text[],timestamptz,timestamptz,timestamptz,uuid,text,timestamptz) to service_role;
grant execute on function public.hq_workforce_bind_objective_context(uuid,uuid,text,text,bigint) to service_role;
grant execute on function public.hq_workforce_recall_context(text,text,text,integer) to service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.3X X2 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then
    raise exception 'WE-R1.3X X2 violated fail-closed runtime boundary';
  end if;
end $$;
