-- WE-R1.4.4: independent postcondition verification for consequential execution.
-- NON-ACTIVATING. This gate creates verification evidence only; runtime, heartbeat,
-- Factory, Shadow, autonomy, risk authority and capability authority remain unchanged.
-- access: service-only public.hq_workforce_execution_verifications
-- authorization-test: public.hq_workforce_execution_verifications denies public/anon/authenticated direct access and service_role is read-only.

alter table public.hq_workforce_execution_intents
  add column if not exists verification_status text not null default 'pending'
    check (verification_status in ('pending','passed','failed')),
  add column if not exists verified_at timestamptz;

create table if not exists public.hq_workforce_execution_verifications (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null unique references public.hq_workforce_execution_intents(id) on delete restrict,
  task_id uuid not null unique references public.hq_workforce_task_contracts(id) on delete restrict,
  authority_grant_id uuid not null references public.hq_workforce_capability_authority_grants(id) on delete restrict,
  plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
  capability_key text not null,
  capability_version integer not null check (capability_version>0),
  verifier_key text not null check (char_length(btrim(verifier_key)) between 3 and 240),
  expected_outcome jsonb not null check (jsonb_typeof(expected_outcome)='object'),
  observed_outcome jsonb not null check (jsonb_typeof(observed_outcome)='object'),
  verification_contract jsonb not null check (jsonb_typeof(verification_contract)='object'),
  passed boolean not null,
  verified_at timestamptz not null default clock_timestamp()
);

create index if not exists hq_workforce_execution_verifications_result_idx
  on public.hq_workforce_execution_verifications(passed,verified_at desc);
create index if not exists hq_workforce_execution_verifications_authority_idx
  on public.hq_workforce_execution_verifications(authority_grant_id,verified_at desc);

alter table public.hq_workforce_execution_verifications enable row level security;
revoke all on table public.hq_workforce_execution_verifications from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_execution_verifications to service_role;

create or replace function public.hq_workforce_guard_execution_verification_immutable()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  raise exception 'execution_verification_immutable';
end $$;

drop trigger if exists trg_hq_workforce_execution_verification_immutable on public.hq_workforce_execution_verifications;
create trigger trg_hq_workforce_execution_verification_immutable
before update or delete on public.hq_workforce_execution_verifications
for each row execute function public.hq_workforce_guard_execution_verification_immutable();

create or replace function public.hq_workforce_verify_consequential_execution(
  p_task_id uuid,
  p_verifier_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  i public.hq_workforce_execution_intents%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  wi public.hq_work_items%rowtype;
  v_expected jsonb;
  v_observed jsonb;
  v_pass boolean:=false;
  v_id uuid;
  v_work_item_id uuid;
begin
  if char_length(btrim(coalesce(p_verifier_key,'')))<3 then raise exception 'independent_verifier_required'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'verification_task_not_found'; end if;
  if p_verifier_key=t.worker_key then raise exception 'worker_cannot_verify_own_execution'; end if;
  if t.status<>'completed' then raise exception 'verification_task_not_completed'; end if;
  if t.verification_status<>'pending' then raise exception 'verification_task_already_finalized'; end if;
  if t.autonomous_authority_grant_id is null or t.plan_step_id is null or t.capability_version is null then raise exception 'verification_task_lineage_missing'; end if;

  select * into i from public.hq_workforce_execution_intents where task_id=t.id for update;
  if not found then raise exception 'verification_execution_intent_missing'; end if;
  if i.status<>'committed' then raise exception 'verification_execution_intent_not_committed'; end if;
  if i.verification_status<>'pending' then raise exception 'verification_intent_already_finalized'; end if;
  if i.authority_grant_id is distinct from t.autonomous_authority_grant_id
     or i.plan_step_id is distinct from t.plan_step_id
     or i.capability_key is distinct from t.capability_key
     or i.capability_version is distinct from t.capability_version then
    raise exception 'verification_execution_lineage_mismatch';
  end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=i.authority_grant_id;
  if not found then raise exception 'verification_authority_missing'; end if;
  if not g.verification_required then raise exception 'verification_not_required_by_authority'; end if;
  if g.verification_contract='{}'::jsonb then raise exception 'verification_contract_missing'; end if;

  if t.resource_type='hq_work_items' and t.operation='update' then
    v_work_item_id:=nullif(t.payload->>'work_item_id','')::uuid;
    if v_work_item_id is null then raise exception 'verification_resource_identity_missing'; end if;
    select * into wi from public.hq_work_items where id=v_work_item_id;
    if not found then
      v_expected:=jsonb_build_object('resource_exists',true,'desired_state',i.desired_state,'task_id',t.id,'intent_id',i.id);
      v_observed:=jsonb_build_object('resource_exists',false);
      v_pass:=false;
    else
      v_expected:=jsonb_build_object(
        'resource_exists',true,
        'status',i.desired_state->>'status',
        'task_id',t.id::text,
        'authority_grant_id',i.authority_grant_id::text,
        'plan_step_id',i.plan_step_id::text,
        'execution_intent_id',i.id::text
      );
      v_observed:=jsonb_build_object(
        'resource_exists',true,
        'status',wi.status,
        'task_id',wi.action_taken->>'task_id',
        'authority_grant_id',wi.action_taken->>'authority_grant_id',
        'plan_step_id',wi.action_taken->>'plan_step_id',
        'execution_intent_id',wi.action_taken->>'execution_intent_id'
      );
      v_pass:=v_expected=v_observed;
    end if;
  else
    raise exception 'unsupported_consequential_verification_contract';
  end if;

  -- Negative evidence is deliberately persisted; do not raise on v_pass=false.
  insert into public.hq_workforce_execution_verifications(
    intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
    verifier_key,expected_outcome,observed_outcome,verification_contract,passed
  ) values(
    i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
    btrim(p_verifier_key),v_expected,v_observed,g.verification_contract,v_pass
  ) returning id into v_id;

  update public.hq_workforce_execution_intents
     set verification_status=case when v_pass then 'passed' else 'failed' end,
         verified_at=clock_timestamp()
   where id=i.id;
  update public.hq_workforce_task_contracts
     set verification_status=case when v_pass then 'verified' else 'failed' end
   where id=t.id;

  return v_id;
end $$;

revoke all on function public.hq_workforce_guard_execution_verification_immutable() from public,anon,authenticated;
revoke all on function public.hq_workforce_verify_consequential_execution(uuid,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_guard_execution_verification_immutable() to service_role;
grant execute on function public.hq_workforce_verify_consequential_execution(uuid,text) to service_role;

-- Gate invariant: verification capability cannot activate execution authority.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.4 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'WE-R1.4.4 violated fail-closed runtime boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.4 cannot activate capability authority'; end if;
end $$;
