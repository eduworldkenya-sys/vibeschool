-- WE-R1.4.14: plan-bound independent verifier assignment.
-- NON-ACTIVATING. Replaces caller-label "independence" with a database-governed
-- separation-of-duty assignment anchored to the owner-approved plan definition.
-- access: service-only public.hq_workforce_verifier_assignments
-- authorization-test: public.hq_workforce_verifier_assignments denies public/anon/authenticated writes and service_role has read-only evidence access.

create table if not exists public.hq_workforce_verifier_assignments (
  id uuid primary key default gen_random_uuid(),
  execution_task_id uuid not null unique references public.hq_workforce_task_contracts(id) on delete restrict,
  verification_task_id uuid not null unique references public.hq_workforce_task_contracts(id) on delete restrict,
  execution_plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
  verification_plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
  executor_worker_key text not null,
  verifier_worker_key text not null,
  approved_plan_id uuid not null references public.hq_workforce_plans(id) on delete restrict,
  approved_plan_hash text not null,
  status text not null default 'assigned' check (status in ('assigned','consumed','cancelled')),
  assigned_at timestamptz not null default clock_timestamp(),
  consumed_at timestamptz,
  check (execution_task_id<>verification_task_id),
  check (execution_plan_step_id<>verification_plan_step_id),
  check (executor_worker_key<>verifier_worker_key),
  check ((status='consumed')=(consumed_at is not null))
);
create index if not exists hq_workforce_verifier_assignments_status_idx
  on public.hq_workforce_verifier_assignments(status,assigned_at);

alter table public.hq_workforce_verifier_assignments enable row level security;
revoke all on table public.hq_workforce_verifier_assignments from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_verifier_assignments to service_role;

create or replace function public.hq_workforce_assign_independent_verifier(
  p_execution_task_id uuid,
  p_verification_task_id uuid
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  et public.hq_workforce_task_contracts%rowtype;
  vt public.hq_workforce_task_contracts%rowtype;
  es public.hq_workforce_plan_steps%rowtype;
  vs public.hq_workforce_plan_steps%rowtype;
  p public.hq_workforce_plans%rowtype;
  o public.hq_workforce_objectives%rowtype;
  v_id uuid;
begin
  if p_execution_task_id=p_verification_task_id then raise exception 'verifier_task_must_be_distinct'; end if;
  perform public.hq_workforce_assert_approved_plan_binding(p_execution_task_id);
  perform public.hq_workforce_assert_approved_plan_binding(p_verification_task_id);

  select * into et from public.hq_workforce_task_contracts where id=p_execution_task_id for update;
  if not found then raise exception 'execution_task_not_found'; end if;
  select * into vt from public.hq_workforce_task_contracts where id=p_verification_task_id for update;
  if not found then raise exception 'verification_task_not_found'; end if;
  if et.status<>'completed' or et.verification_status<>'pending' then raise exception 'execution_task_not_pending_verification'; end if;
  if vt.status<>'running' then raise exception 'verification_task_not_running'; end if;
  if et.worker_key=vt.worker_key then raise exception 'executor_and_verifier_worker_must_differ'; end if;
  if et.plan_step_id is null or vt.plan_step_id is null then raise exception 'verifier_assignment_plan_lineage_missing'; end if;

  select * into es from public.hq_workforce_plan_steps where id=et.plan_step_id;
  select * into vs from public.hq_workforce_plan_steps where id=vt.plan_step_id;
  if es.id is null or vs.id is null then raise exception 'verifier_assignment_plan_step_missing'; end if;
  if es.plan_id<>vs.plan_id then raise exception 'verifier_assignment_requires_same_approved_plan'; end if;
  if vs.worker_key is null or vs.worker_key<>vt.worker_key then raise exception 'verification_task_worker_not_plan_bound'; end if;
  if es.worker_key is not null and es.worker_key<>et.worker_key then raise exception 'execution_task_worker_not_plan_bound'; end if;

  select * into p from public.hq_workforce_plans where id=es.plan_id;
  select * into o from public.hq_workforce_objectives where id=p.objective_id;
  if o.status<>'approved' or o.approved_plan_id<>p.id or o.approved_plan_hash is null then raise exception 'verifier_assignment_plan_not_owner_approved'; end if;

  if not exists(
    select 1
    from public.hq_workforce_plan_step_capabilities psc
    join public.hq_workforce_capabilities c on c.id=psc.capability_id
    where psc.plan_step_id=vs.id and psc.role='verification'
      and c.capability_key=vt.capability_key and c.version=vt.capability_version
      and c.lifecycle_status='certified'
  ) then raise exception 'verification_task_capability_not_approved_for_verification_step'; end if;

  if not exists(select 1 from public.hq_workforce_workers w where w.worker_key=vt.worker_key and w.status='active') then raise exception 'verifier_worker_not_active'; end if;
  if public.hq_workforce_current_lifecycle_state(vt.worker_key)<>'active' then raise exception 'verifier_worker_lifecycle_not_active'; end if;
  if not exists(select 1 from public.hq_workforce_identities i where i.worker_key=vt.worker_key and i.status='active' and i.expires_at>clock_timestamp()) then raise exception 'verifier_identity_invalid'; end if;
  if not exists(select 1 from public.hq_workforce_certifications c where c.worker_key=vt.worker_key and c.status='active' and c.expires_at>clock_timestamp()) then raise exception 'verifier_certification_invalid'; end if;

  insert into public.hq_workforce_verifier_assignments(
    execution_task_id,verification_task_id,execution_plan_step_id,verification_plan_step_id,
    executor_worker_key,verifier_worker_key,approved_plan_id,approved_plan_hash
  ) values(
    et.id,vt.id,es.id,vs.id,et.worker_key,vt.worker_key,p.id,o.approved_plan_hash
  ) returning id into v_id;
  return v_id;
end $$;

-- Preserve the deterministic R1.4 verifier body but make direct invocation impossible.
alter function public.hq_workforce_verify_consequential_execution(uuid,text)
  rename to hq_workforce_verify_consequential_execution_r14_unbound_internal;

create or replace function public.hq_workforce_verify_consequential_execution(
  p_task_id uuid,
  p_verifier_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  a public.hq_workforce_verifier_assignments%rowtype;
  v_verification_id uuid;
begin
  select * into a from public.hq_workforce_verifier_assignments
   where execution_task_id=p_task_id and status='assigned'
   for update;
  if not found then raise exception 'independent_verifier_assignment_required'; end if;
  if a.verifier_worker_key is distinct from btrim(p_verifier_key) then raise exception 'verifier_identity_not_assignment_bound'; end if;

  -- Recheck the approval fingerprint at the moment verification occurs. If the plan was
  -- modified after review, verification cannot bless the execution.
  perform public.hq_workforce_assert_approved_plan_binding(p_task_id);
  if a.approved_plan_hash is distinct from public.hq_workforce_plan_authority_hash(a.approved_plan_id) then
    raise exception 'verifier_assignment_plan_definition_changed';
  end if;
  if not exists(
    select 1 from public.hq_workforce_task_contracts vt
    where vt.id=a.verification_task_id and vt.worker_key=a.verifier_worker_key and vt.plan_step_id=a.verification_plan_step_id and vt.status='running'
  ) then raise exception 'verification_task_assignment_no_longer_valid'; end if;

  v_verification_id:=public.hq_workforce_verify_consequential_execution_r14_unbound_internal(p_task_id,a.verifier_worker_key);
  update public.hq_workforce_verifier_assignments set status='consumed',consumed_at=clock_timestamp() where id=a.id;
  return v_verification_id;
end $$;

revoke all on function public.hq_workforce_assign_independent_verifier(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_assign_independent_verifier(uuid,uuid) to service_role;
revoke all on function public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_verify_consequential_execution(uuid,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_verify_consequential_execution(uuid,text) to service_role;

-- NON-ACTIVATION + separation-of-duty attestation.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.14 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.14 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.14 cannot install with active capability authority'; end if;
  if has_function_privilege('service_role','public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text)','EXECUTE') then
    raise exception 'WE-R1.4.14 unbound verifier still externally callable';
  end if;
end $$;
