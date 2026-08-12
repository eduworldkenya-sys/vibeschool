-- Worker Engine WE-L1: Authority & Lifecycle Convergence
-- Additive only. Does not mutate legacy worker status or enable autonomous execution.

create table if not exists public.hq_workforce_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_type text not null check (contract_type in ('demand_evidence','worker_creation','blueprint','worker_identity','skill','task','context','tool','ai_invocation','verification','certification','suspension','retirement','audit')),
  contract_key text not null,
  version integer not null check (version > 0),
  payload jsonb not null,
  payload_hash text generated always as (encode(digest(payload::text, 'sha256'), 'hex')) stored,
  scope_type text not null default 'platform_internal' check (scope_type in ('platform_internal','global','school','multi_school')),
  scope_ref jsonb not null default '{}'::jsonb,
  status text not null default 'issued' check (status in ('issued','superseded','revoked','expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(contract_type, contract_key, version),
  check (expires_at is null or expires_at > issued_at)
);

create table if not exists public.hq_workforce_blueprints (
  id uuid primary key default gen_random_uuid(),
  blueprint_key text not null,
  version integer not null check (version > 0),
  title text not null,
  mission text not null,
  authority_ceiling jsonb not null default '[]'::jsonb,
  required_capabilities jsonb not null default '[]'::jsonb,
  required_skill_keys jsonb not null default '[]'::jsonb,
  approval_boundaries jsonb not null default '[]'::jsonb,
  scope_type text not null default 'platform_internal' check (scope_type in ('platform_internal','global','school','multi_school')),
  scope_ref jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','superseded','revoked')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(blueprint_key, version),
  check ((status <> 'approved') or approved_at is not null)
);

create table if not exists public.hq_workforce_creation_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null unique,
  worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  blueprint_id uuid not null references public.hq_workforce_blueprints(id) on delete restrict,
  demand_evidence_contract_id uuid references public.hq_workforce_contracts(id) on delete restrict,
  authority_ceiling jsonb not null default '[]'::jsonb,
  scope_type text not null default 'platform_internal' check (scope_type in ('platform_internal','global','school','multi_school')),
  scope_ref jsonb not null default '{}'::jsonb,
  status text not null default 'issued' check (status in ('issued','consumed','revoked','expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  consumed_at timestamptz,
  check (expires_at is null or expires_at > issued_at),
  check ((status <> 'consumed') or consumed_at is not null)
);

create table if not exists public.hq_workforce_lifecycle_events (
  id bigint generated always as identity primary key,
  worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  from_state text,
  to_state text not null check (to_state in ('proposed','requested','instantiated','provisioned','shadow','certification_pending','certified','active','suspended','remediation','retired','archived')),
  reason text not null,
  creation_contract_id uuid references public.hq_workforce_creation_contracts(id) on delete restrict,
  certification_id uuid,
  occurred_at timestamptz not null default now()
);
create index if not exists hq_workforce_lifecycle_events_worker_idx on public.hq_workforce_lifecycle_events(worker_key, id desc);

create table if not exists public.hq_workforce_identities (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  identity_key text not null unique,
  credential_ref text,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason text,
  check (expires_at > issued_at),
  check ((status <> 'revoked') or revoked_at is not null)
);
create unique index if not exists hq_workforce_one_live_identity_idx on public.hq_workforce_identities(worker_key) where status='active';

create table if not exists public.hq_workforce_capability_grants (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  capability_key text not null,
  operation text not null,
  resource_type text not null,
  scope_type text not null default 'platform_internal' check (scope_type in ('platform_internal','global','school','multi_school')),
  scope_ref jsonb not null default '{}'::jsonb,
  granted_by_contract_id uuid not null references public.hq_workforce_creation_contracts(id) on delete restrict,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason text,
  check (expires_at > granted_at),
  check ((status <> 'revoked') or revoked_at is not null)
);
create index if not exists hq_workforce_capability_lookup_idx on public.hq_workforce_capability_grants(worker_key, capability_key, status, expires_at);

create table if not exists public.hq_workforce_execution_budgets (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  budget_key text not null,
  unit text not null check (unit in ('task','tool_call','model_token','compute_ms','message','exposure_minor')),
  limit_amount bigint not null check (limit_amount >= 0),
  consumed_amount bigint not null default 0 check (consumed_amount >= 0),
  reserved_amount bigint not null default 0 check (reserved_amount >= 0),
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'active' check (status in ('active','exhausted','expired','revoked')),
  created_at timestamptz not null default now(),
  unique(worker_key,budget_key,period_start),
  check (period_end > period_start),
  check (consumed_amount + reserved_amount <= limit_amount)
);

create or replace function public.hq_workforce_current_lifecycle_state(p_worker_key text)
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(
    (select e.to_state from public.hq_workforce_lifecycle_events e where e.worker_key=p_worker_key order by e.id desc limit 1),
    case (select w.status from public.hq_workforce_workers w where w.worker_key=p_worker_key)
      when 'draft' then 'proposed'
      when 'probation' then 'provisioned'
      when 'active' then 'active'
      when 'restricted' then 'suspended'
      when 'suspended' then 'suspended'
      when 'retired' then 'retired'
      else null end
  );
$$;

create or replace function public.hq_workforce_transition_worker(p_worker_key text,p_to_state text,p_reason text,p_creation_contract_id uuid default null)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_from text; v_allowed boolean := false; v_contract public.hq_workforce_creation_contracts%rowtype;
begin
  if coalesce(trim(p_reason),'')='' then raise exception 'transition_reason_required'; end if;
  perform 1 from public.hq_workforce_workers where worker_key=p_worker_key for update;
  if not found then raise exception 'worker_not_found'; end if;
  v_from:=public.hq_workforce_current_lifecycle_state(p_worker_key);
  v_allowed := case
    when v_from='proposed' and p_to_state='requested' then true
    when v_from='requested' and p_to_state='instantiated' then true
    when v_from='instantiated' and p_to_state='provisioned' then true
    when v_from='provisioned' and p_to_state='shadow' then true
    when v_from='shadow' and p_to_state='certification_pending' then true
    when v_from='certification_pending' and p_to_state='certified' then true
    when v_from='certified' and p_to_state='active' then true
    when v_from='active' and p_to_state='suspended' then true
    when v_from='suspended' and p_to_state in ('remediation','retired') then true
    when v_from='remediation' and p_to_state='certification_pending' then true
    when v_from='active' and p_to_state='retired' then true
    when v_from='retired' and p_to_state='archived' then true
    else false end;
  if not v_allowed then raise exception 'illegal_worker_lifecycle_transition:%->%',v_from,p_to_state; end if;
  if p_to_state in ('instantiated','provisioned','shadow','certification_pending','certified','active') then
    if p_creation_contract_id is null then raise exception 'creation_contract_required'; end if;
    select * into v_contract from public.hq_workforce_creation_contracts where id=p_creation_contract_id and worker_key=p_worker_key and status in ('issued','consumed') and (expires_at is null or expires_at>now()) for update;
    if not found then raise exception 'valid_creation_contract_required'; end if;
  end if;
  insert into public.hq_workforce_lifecycle_events(worker_key,from_state,to_state,reason,creation_contract_id) values(p_worker_key,v_from,p_to_state,p_reason,p_creation_contract_id);
  return p_to_state;
end $$;

create or replace function public.hq_workforce_assert_identity(p_worker_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  select id into v_id from public.hq_workforce_identities where worker_key=p_worker_key and status='active' and expires_at>now() order by issued_at desc limit 1;
  if v_id is null then raise exception 'worker_identity_invalid_or_revoked'; end if;
  return v_id;
end $$;

create or replace function public.hq_workforce_assert_capability(p_worker_key text,p_capability_key text,p_operation text,p_resource_type text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  perform public.hq_workforce_assert_identity(p_worker_key);
  if public.hq_workforce_current_lifecycle_state(p_worker_key)<>'active' then raise exception 'worker_not_active'; end if;
  select id into v_id from public.hq_workforce_capability_grants where worker_key=p_worker_key and capability_key=p_capability_key and operation=p_operation and resource_type=p_resource_type and status='active' and expires_at>now() order by granted_at desc limit 1;
  if v_id is null then raise exception 'worker_capability_denied'; end if;
  return v_id;
end $$;

create or replace function public.hq_workforce_reserve_budget(p_worker_key text,p_budget_key text,p_amount bigint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_amount<=0 then raise exception 'budget_reservation_must_be_positive'; end if;
  perform public.hq_workforce_assert_identity(p_worker_key);
  update public.hq_workforce_execution_budgets set reserved_amount=reserved_amount+p_amount,
    status=case when consumed_amount+reserved_amount+p_amount=limit_amount then 'exhausted' else status end
  where worker_key=p_worker_key and budget_key=p_budget_key and status='active' and now()>=period_start and now()<period_end and consumed_amount+reserved_amount+p_amount<=limit_amount
  returning id into v_id;
  if v_id is null then raise exception 'worker_budget_exhausted_or_missing'; end if;
  return v_id;
end $$;

create or replace function public.hq_workforce_consume_budget(p_budget_id uuid,p_amount bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_amount<=0 then raise exception 'budget_consumption_must_be_positive'; end if;
  update public.hq_workforce_execution_budgets set reserved_amount=reserved_amount-p_amount,consumed_amount=consumed_amount+p_amount,
    status=case when consumed_amount+p_amount=limit_amount then 'exhausted' else status end
  where id=p_budget_id and reserved_amount>=p_amount and consumed_amount+p_amount<=limit_amount;
  if not found then raise exception 'invalid_budget_consumption'; end if;
end $$;

create or replace function public.hq_workforce_revoke_identity(p_worker_key text,p_reason text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count integer;
begin
  if coalesce(trim(p_reason),'')='' then raise exception 'revocation_reason_required'; end if;
  update public.hq_workforce_identities set status='revoked',revoked_at=now(),revocation_reason=p_reason where worker_key=p_worker_key and status='active';
  get diagnostics v_count=row_count;
  update public.hq_workforce_capability_grants set status='revoked',revoked_at=now(),revocation_reason='identity_revoked:'||p_reason where worker_key=p_worker_key and status='active';
  update public.hq_workforce_execution_budgets set status='revoked' where worker_key=p_worker_key and status in ('active','exhausted');
  return v_count;
end $$;

-- Fail closed at Data API. Privileged mutation is service-role only.
alter table public.hq_workforce_contracts enable row level security;
alter table public.hq_workforce_blueprints enable row level security;
alter table public.hq_workforce_creation_contracts enable row level security;
alter table public.hq_workforce_lifecycle_events enable row level security;
alter table public.hq_workforce_identities enable row level security;
alter table public.hq_workforce_capability_grants enable row level security;
alter table public.hq_workforce_execution_budgets enable row level security;

revoke all on public.hq_workforce_contracts,public.hq_workforce_blueprints,public.hq_workforce_creation_contracts,public.hq_workforce_lifecycle_events,public.hq_workforce_identities,public.hq_workforce_capability_grants,public.hq_workforce_execution_budgets from public,anon,authenticated;
grant select,insert,update,delete on public.hq_workforce_contracts,public.hq_workforce_blueprints,public.hq_workforce_creation_contracts,public.hq_workforce_lifecycle_events,public.hq_workforce_identities,public.hq_workforce_capability_grants,public.hq_workforce_execution_budgets to service_role;
grant usage,select on sequence public.hq_workforce_lifecycle_events_id_seq to service_role;

revoke all on function public.hq_workforce_current_lifecycle_state(text) from public,anon,authenticated;
revoke all on function public.hq_workforce_transition_worker(text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.hq_workforce_assert_identity(text) from public,anon,authenticated;
revoke all on function public.hq_workforce_assert_capability(text,text,text,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_reserve_budget(text,text,bigint) from public,anon,authenticated;
revoke all on function public.hq_workforce_consume_budget(uuid,bigint) from public,anon,authenticated;
revoke all on function public.hq_workforce_revoke_identity(text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_current_lifecycle_state(text),public.hq_workforce_transition_worker(text,text,text,uuid),public.hq_workforce_assert_identity(text),public.hq_workforce_assert_capability(text,text,text,text),public.hq_workforce_reserve_budget(text,text,bigint),public.hq_workforce_consume_budget(uuid,bigint),public.hq_workforce_revoke_identity(text,text) to service_role;
