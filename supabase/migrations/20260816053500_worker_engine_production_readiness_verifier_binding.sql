-- Worker Engine production-readiness hardening: independent verifier identity binding.
-- NON-ACTIVATING. Creates no verifier assignments, capabilities, or authority.
-- access: service-only public.hq_workforce_verifier_assignments (no direct service_role CRUD)
-- authorization-test: verifier assignments can be created only through owner-gated authenticated RPC; service_role cannot manufacture them.

create table if not exists public.hq_workforce_verifier_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.hq_workforce_task_contracts(id) on delete restrict,
  verifier_worker_key text not null references public.hq_workforce_workers(worker_key) on update cascade on delete restrict,
  verifier_identity_id uuid not null references public.hq_workforce_identities(id) on delete restrict,
  verifier_capability_grant_id uuid not null references public.hq_workforce_capability_grants(id) on delete restrict,
  assigned_by uuid not null,
  status text not null default 'assigned' check (status in ('assigned','consumed','revoked','expired')),
  assigned_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  check (expires_at > assigned_at),
  check (status<>'consumed' or consumed_at is not null),
  check (status<>'revoked' or revoked_at is not null)
);

alter table public.hq_workforce_execution_verifications
  add column if not exists verifier_assignment_id uuid references public.hq_workforce_verifier_assignments(id) on delete restrict;

alter table public.hq_workforce_verifier_assignments enable row level security;
revoke all on table public.hq_workforce_verifier_assignments from public,anon,authenticated,service_role;

create or replace function public.hq_workforce_assign_verifier(
  p_task_id uuid,
  p_verifier_worker_key text,
  p_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  v_identity_id uuid;
  v_capability_grant_id uuid;
  v_id uuid;
begin
  perform public.hq_assert_owner();
  if auth.uid() is null then raise exception 'verifier_assignment_authenticated_owner_required'; end if;
  if p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '24 hours' then
    raise exception 'verifier_assignment_expiry_invalid';
  end if;
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'verification_task_not_found'; end if;
  if p_verifier_worker_key=t.worker_key then raise exception 'worker_cannot_be_assigned_to_verify_own_execution'; end if;
  if public.hq_workforce_current_lifecycle_state(p_verifier_worker_key)<>'active' then raise exception 'verifier_worker_not_active'; end if;
  select id into v_identity_id
    from public.hq_workforce_identities
   where worker_key=p_verifier_worker_key and status='active' and expires_at>clock_timestamp()
   order by issued_at desc limit 1;
  if v_identity_id is null then raise exception 'verifier_identity_invalid_or_revoked'; end if;
  select id into v_capability_grant_id
    from public.hq_workforce_capability_grants
   where worker_key=p_verifier_worker_key
     and capability_key='internal.execution.verify'
     and operation='verify'
     and resource_type='hq_workforce_execution_intents'
     and status='active' and expires_at>clock_timestamp()
   order by granted_at desc limit 1;
  if v_capability_grant_id is null then raise exception 'verifier_capability_denied'; end if;

  insert into public.hq_workforce_verifier_assignments(
    task_id,verifier_worker_key,verifier_identity_id,verifier_capability_grant_id,assigned_by,expires_at
  ) values(
    p_task_id,p_verifier_worker_key,v_identity_id,v_capability_grant_id,auth.uid(),p_expires_at
  ) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.hq_workforce_assign_verifier(uuid,text,timestamptz) from public,anon,service_role;
grant execute on function public.hq_workforce_assign_verifier(uuid,text,timestamptz) to authenticated;

create or replace function public.hq_workforce_bind_verification_identity()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  a public.hq_workforce_verifier_assignments%rowtype;
  ident public.hq_workforce_identities%rowtype;
  cap public.hq_workforce_capability_grants%rowtype;
  executor_key text;
begin
  select worker_key into executor_key from public.hq_workforce_task_contracts where id=new.task_id;
  if executor_key is null then raise exception 'verification_task_identity_missing'; end if;

  select * into a
    from public.hq_workforce_verifier_assignments
   where task_id=new.task_id
     and verifier_worker_key=new.verifier_key
     and status='assigned'
     and expires_at>clock_timestamp()
   for update;
  if not found then raise exception 'authorized_verifier_assignment_required'; end if;
  if a.verifier_worker_key=executor_key then raise exception 'worker_cannot_verify_own_execution'; end if;
  if public.hq_workforce_current_lifecycle_state(a.verifier_worker_key)<>'active' then raise exception 'verifier_worker_not_active'; end if;

  select * into ident from public.hq_workforce_identities where id=a.verifier_identity_id;
  if not found or ident.worker_key<>a.verifier_worker_key or ident.status<>'active' or ident.expires_at<=clock_timestamp() then
    raise exception 'verifier_identity_invalid_or_revoked';
  end if;
  select * into cap from public.hq_workforce_capability_grants where id=a.verifier_capability_grant_id;
  if not found or cap.worker_key<>a.verifier_worker_key
     or cap.capability_key<>'internal.execution.verify' or cap.operation<>'verify'
     or cap.resource_type<>'hq_workforce_execution_intents'
     or cap.status<>'active' or cap.expires_at<=clock_timestamp() then
    raise exception 'verifier_capability_invalid_or_revoked';
  end if;

  new.verifier_assignment_id:=a.id;
  update public.hq_workforce_verifier_assignments
     set status='consumed',consumed_at=clock_timestamp()
   where id=a.id and status='assigned';
  if not found then raise exception 'verifier_assignment_consumption_race'; end if;
  return new;
end $$;

revoke all on function public.hq_workforce_bind_verification_identity() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_bind_verification_identity on public.hq_workforce_execution_verifications;
create trigger trg_hq_workforce_bind_verification_identity
before insert on public.hq_workforce_execution_verifications
for each row execute function public.hq_workforce_bind_verification_identity();

-- No verifier assignment or capability is created by this migration.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_assignments integer; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'verifier binding requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'verifier binding changed runtime boundary'; end if;
  select count(*) into v_assignments from public.hq_workforce_verifier_assignments;
  if v_assignments<>0 then raise exception 'verifier binding created assignment'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'verifier binding activated consequential authority'; end if;
end $$;
