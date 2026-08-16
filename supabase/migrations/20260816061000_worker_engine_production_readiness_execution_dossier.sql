-- Worker Engine production-readiness hardening: canonical execution identity + operator dossier.
-- NON-ACTIVATING. This migration creates correlation/read evidence only.
-- access: service-only public.hq_workforce_execution_envelopes
-- authorization-test: public.hq_workforce_execution_envelopes denies public/anon/authenticated/service_role direct mutation; only the internal task trigger creates identities.

create table if not exists public.hq_workforce_execution_envelopes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.hq_workforce_task_contracts(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.hq_workforce_execution_envelopes enable row level security;
revoke all on table public.hq_workforce_execution_envelopes from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_execution_envelopes to service_role;

create or replace function public.hq_workforce_ensure_execution_envelope()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.status='running' then
    insert into public.hq_workforce_execution_envelopes(task_id)
    values(new.id) on conflict(task_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.hq_workforce_ensure_execution_envelope() from public,anon,authenticated,service_role;

drop trigger if exists trg_hq_workforce_ensure_execution_envelope on public.hq_workforce_task_contracts;
create trigger trg_hq_workforce_ensure_execution_envelope
before insert or update of status on public.hq_workforce_task_contracts
for each row execute function public.hq_workforce_ensure_execution_envelope();

-- Reconcile already-running tasks without changing their lifecycle or authority.
insert into public.hq_workforce_execution_envelopes(task_id)
select id from public.hq_workforce_task_contracts where status='running'
on conflict(task_id) do nothing;

-- Owner-only deterministic read model. The execution envelope id is the canonical execution_id.
create or replace function public.hq_workforce_get_execution_dossier(p_execution_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  e public.hq_workforce_execution_envelopes%rowtype;
  t public.hq_workforce_task_contracts%rowtype;
  i public.hq_workforce_execution_intents%rowtype;
  ps public.hq_workforce_plan_steps%rowtype;
  p public.hq_workforce_plans%rowtype;
  o public.hq_workforce_objectives%rowtype;
  v_verification jsonb;
  v_compensations jsonb;
  v_outcomes jsonb;
  v_escalations jsonb;
  v_breakers jsonb;
  v_usage jsonb;
  v_assignment jsonb;
  v_missing jsonb:='[]'::jsonb;
  v_required integer:=8;
  v_present integer:=0;
  v_complete boolean:=false;
begin
  perform public.hq_assert_owner();
  if auth.uid() is null then raise exception 'execution_dossier_authenticated_owner_required'; end if;

  select * into e from public.hq_workforce_execution_envelopes where id=p_execution_id;
  if not found then raise exception 'execution_not_found'; end if;
  select * into t from public.hq_workforce_task_contracts where id=e.task_id;
  if not found then raise exception 'execution_task_missing'; end if;
  if t.plan_step_id is not null then select * into ps from public.hq_workforce_plan_steps where id=t.plan_step_id; end if;
  if ps.id is not null then select * into p from public.hq_workforce_plans where id=ps.plan_id; end if;
  if p.id is not null then select * into o from public.hq_workforce_objectives where id=p.objective_id; end if;
  select * into i from public.hq_workforce_execution_intents where task_id=t.id;

  select coalesce(jsonb_agg(to_jsonb(v) order by v.verified_at),'[]'::jsonb) into v_verification
    from public.hq_workforce_execution_verifications v where v.task_id=t.id;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) into v_compensations
    from public.hq_workforce_execution_compensations c where c.task_id=t.id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) into v_outcomes
    from public.hq_workforce_execution_outcomes x where x.task_id=t.id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]'::jsonb) into v_escalations
    from public.hq_workforce_execution_escalations x where x.task_id=t.id;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at),'[]'::jsonb) into v_breakers
    from public.hq_workforce_execution_breaker_events b where b.task_id=t.id;
  select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at),'[]'::jsonb) into v_usage
    from public.hq_workforce_capability_execution_usage u where u.task_id=t.id;
  select coalesce((select to_jsonb(a) from public.hq_workforce_verifier_assignments a where a.task_id=t.id),'null'::jsonb) into v_assignment;

  -- Mandatory lineage for any consequential execution dossier.
  if o.id is null then v_missing:=v_missing||'"objective"'::jsonb; else v_present:=v_present+1; end if;
  if p.id is null then v_missing:=v_missing||'"plan"'::jsonb; else v_present:=v_present+1; end if;
  if ps.id is null then v_missing:=v_missing||'"plan_step"'::jsonb; else v_present:=v_present+1; end if;
  if nullif(t.worker_key,'') is null then v_missing:=v_missing||'"worker"'::jsonb; else v_present:=v_present+1; end if;
  if nullif(t.capability_key,'') is null or t.capability_version is null then v_missing:=v_missing||'"capability"'::jsonb; else v_present:=v_present+1; end if;
  if t.autonomous_authority_grant_id is null then v_missing:=v_missing||'"authority"'::jsonb; else v_present:=v_present+1; end if;
  if i.id is null then v_missing:=v_missing||'"execution_intent"'::jsonb; else v_present:=v_present+1; end if;
  if i.id is not null and i.status='committed' and jsonb_array_length(v_verification)=0 then
    v_missing:=v_missing||'"verification"'::jsonb;
  elsif i.id is not null and i.status='committed' then v_present:=v_present+1;
  else v_required:=v_required-1; end if;

  -- Failed verification requires recovery/outcome evidence; blocked execution requires breaker evidence.
  if i.id is not null and i.verification_status='failed' then
    v_required:=v_required+2;
    if jsonb_array_length(v_compensations)=0 then v_missing:=v_missing||'"compensation"'::jsonb; else v_present:=v_present+1; end if;
    if jsonb_array_length(v_outcomes)=0 then v_missing:=v_missing||'"outcome"'::jsonb; else v_present:=v_present+1; end if;
  elsif i.id is not null and i.status='committed' and i.verification_status='passed' then
    v_required:=v_required+1;
    if jsonb_array_length(v_outcomes)=0 then v_missing:=v_missing||'"outcome"'::jsonb; else v_present:=v_present+1; end if;
  end if;
  if i.id is not null and i.status='blocked' then
    v_required:=v_required+1;
    if jsonb_array_length(v_breakers)=0 then v_missing:=v_missing||'"breaker_denial"'::jsonb; else v_present:=v_present+1; end if;
  end if;

  v_complete:=jsonb_array_length(v_missing)=0;
  return jsonb_build_object(
    'execution_id',e.id,
    'task_id',t.id,
    'completeness',jsonb_build_object('complete',v_complete,'present',v_present,'required',v_required,'missing',v_missing),
    'objective',case when o.id is null then null else to_jsonb(o) end,
    'plan',case when p.id is null then null else to_jsonb(p) end,
    'plan_step',case when ps.id is null then null else to_jsonb(ps) end,
    'task',to_jsonb(t),
    'execution_intent',case when i.id is null then null else to_jsonb(i) end,
    'verifier_assignment',v_assignment,
    'verifications',v_verification,
    'compensations',v_compensations,
    'outcomes',v_outcomes,
    'escalations',v_escalations,
    'breaker_events',v_breakers,
    'capability_usage',v_usage,
    'generated_at',clock_timestamp()
  );
end $$;

revoke all on function public.hq_workforce_get_execution_dossier(uuid) from public,anon,service_role;
grant execute on function public.hq_workforce_get_execution_dossier(uuid) to authenticated;

-- Engineering remains non-activating.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'execution dossier requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'execution dossier changed runtime boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'execution dossier activated authority'; end if;
end $$;
