-- WE-R1.4.6: deterministic execution outcome classification + evidence-only escalation.
-- NON-ACTIVATING. This gate classifies already-governed execution/verification/recovery
-- evidence. It does not grant authority, retry consequential business outcomes, mutate
-- governed resources, or enable runtime, heartbeat, Factory, Shadow, autonomy or risk.
-- access: service-only public.hq_workforce_execution_outcomes
-- authorization-test: public.hq_workforce_execution_outcomes denies public/anon/authenticated direct access and service_role is read-only.
-- access: service-only public.hq_workforce_execution_escalations
-- authorization-test: public.hq_workforce_execution_escalations denies public/anon/authenticated direct access and service_role is read-only.

create table if not exists public.hq_workforce_execution_outcomes (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.hq_workforce_execution_intents(id) on delete restrict,
  task_id uuid not null references public.hq_workforce_task_contracts(id) on delete restrict,
  authority_grant_id uuid not null references public.hq_workforce_capability_authority_grants(id) on delete restrict,
  plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
  capability_key text not null,
  capability_version integer not null check (capability_version>0),
  classification text not null check (classification in (
    'recovery_required',
    'verified_success',
    'recovered_compensated',
    'state_diverged',
    'compensation_denied',
    'ambiguous_evidence'
  )),
  reason_code text not null check (char_length(btrim(reason_code)) between 3 and 240),
  terminal boolean not null,
  retry_allowed boolean not null default false,
  max_retry_attempts integer not null default 0 check (max_retry_attempts between 0 and 3),
  escalation_required boolean not null default false,
  human_intervention_required boolean not null default false,
  classified_by text not null check (char_length(btrim(classified_by)) between 3 and 240),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default clock_timestamp(),
  check (not retry_allowed or max_retry_attempts>0),
  check (retry_allowed or max_retry_attempts=0),
  check (not human_intervention_required or escalation_required),
  check (classification<>'recovery_required' or not terminal),
  check (classification='recovery_required' or terminal)
);

create unique index if not exists hq_workforce_execution_outcomes_stage_idx
  on public.hq_workforce_execution_outcomes(intent_id,classification);
create unique index if not exists hq_workforce_execution_outcomes_one_terminal_idx
  on public.hq_workforce_execution_outcomes(intent_id)
  where terminal;
create index if not exists hq_workforce_execution_outcomes_classification_idx
  on public.hq_workforce_execution_outcomes(classification,created_at desc);

create table if not exists public.hq_workforce_execution_escalations (
  id uuid primary key default gen_random_uuid(),
  outcome_id uuid not null unique references public.hq_workforce_execution_outcomes(id) on delete restrict,
  intent_id uuid not null references public.hq_workforce_execution_intents(id) on delete restrict,
  task_id uuid not null references public.hq_workforce_task_contracts(id) on delete restrict,
  authority_grant_id uuid not null references public.hq_workforce_capability_authority_grants(id) on delete restrict,
  plan_step_id uuid not null references public.hq_workforce_plan_steps(id) on delete restrict,
  capability_key text not null,
  capability_version integer not null check (capability_version>0),
  category text not null check (category in ('state_divergence','recovery_denied','ambiguous_evidence')),
  reason_code text not null check (char_length(btrim(reason_code)) between 3 and 240),
  human_intervention_required boolean not null default true,
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists hq_workforce_execution_escalations_category_idx
  on public.hq_workforce_execution_escalations(category,created_at desc);

alter table public.hq_workforce_execution_outcomes enable row level security;
alter table public.hq_workforce_execution_escalations enable row level security;
revoke all on table public.hq_workforce_execution_outcomes from public,anon,authenticated,service_role;
revoke all on table public.hq_workforce_execution_escalations from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_execution_outcomes to service_role;
grant select on table public.hq_workforce_execution_escalations to service_role;

create or replace function public.hq_workforce_guard_execution_outcome_immutable()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  raise exception 'execution_outcome_immutable';
end $$;

create or replace function public.hq_workforce_guard_execution_escalation_immutable()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  raise exception 'execution_escalation_immutable';
end $$;

drop trigger if exists trg_hq_workforce_execution_outcome_immutable on public.hq_workforce_execution_outcomes;
create trigger trg_hq_workforce_execution_outcome_immutable
before update or delete on public.hq_workforce_execution_outcomes
for each row execute function public.hq_workforce_guard_execution_outcome_immutable();

drop trigger if exists trg_hq_workforce_execution_escalation_immutable on public.hq_workforce_execution_escalations;
create trigger trg_hq_workforce_execution_escalation_immutable
before update or delete on public.hq_workforce_execution_escalations
for each row execute function public.hq_workforce_guard_execution_escalation_immutable();

create or replace function public.hq_workforce_classify_execution_outcome(
  p_task_id uuid,
  p_classified_by text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  i public.hq_workforce_execution_intents%rowtype;
  v public.hq_workforce_execution_verifications%rowtype;
  c public.hq_workforce_execution_compensations%rowtype;
  o public.hq_workforce_execution_outcomes%rowtype;
  v_classification text;
  v_reason text;
  v_terminal boolean:=true;
  v_escalate boolean:=false;
  v_human boolean:=false;
  v_category text;
  v_evidence jsonb:='{}'::jsonb;
  v_outcome_id uuid;
begin
  if char_length(btrim(coalesce(p_classified_by,'')))<3 then raise exception 'outcome_classifier_required'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'outcome_task_not_found'; end if;

  select * into i from public.hq_workforce_execution_intents where task_id=t.id for update;
  if not found then raise exception 'outcome_execution_intent_missing'; end if;
  if i.status not in ('committed','compensated') then raise exception 'outcome_execution_not_committed'; end if;
  if i.authority_grant_id is distinct from t.autonomous_authority_grant_id
     or i.plan_step_id is distinct from t.plan_step_id
     or i.capability_key is distinct from t.capability_key
     or i.capability_version is distinct from t.capability_version then
    raise exception 'outcome_execution_lineage_mismatch';
  end if;

  select * into o
    from public.hq_workforce_execution_outcomes
   where intent_id=i.id and terminal
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object(
      'outcome_id',o.id,'classification',o.classification,'terminal',o.terminal,
      'retry_allowed',o.retry_allowed,'max_retry_attempts',o.max_retry_attempts,
      'escalation_required',o.escalation_required,'human_intervention_required',o.human_intervention_required,
      'reused',true
    );
  end if;

  select * into v from public.hq_workforce_execution_verifications where intent_id=i.id;
  if not found then
    if i.verification_status='pending' then raise exception 'outcome_verification_pending'; end if;
    v_classification:='ambiguous_evidence';
    v_reason:='verification_evidence_missing';
    v_escalate:=true;
    v_human:=true;
    v_category:='ambiguous_evidence';
    v_evidence:=jsonb_build_object('intent_verification_status',i.verification_status,'verification_row_present',false);
  elsif v.authority_grant_id is distinct from i.authority_grant_id
     or v.plan_step_id is distinct from i.plan_step_id
     or v.task_id is distinct from i.task_id
     or v.capability_key is distinct from i.capability_key
     or v.capability_version is distinct from i.capability_version then
    v_classification:='ambiguous_evidence';
    v_reason:='verification_lineage_mismatch';
    v_escalate:=true;
    v_human:=true;
    v_category:='ambiguous_evidence';
    v_evidence:=jsonb_build_object('verification_id',v.id,'lineage_match',false);
  elsif v.passed and i.verification_status='passed' and i.status='committed' then
    v_classification:='verified_success';
    v_reason:='independent_verification_passed';
    v_evidence:=jsonb_build_object('verification_id',v.id,'verification_passed',true);
  elsif (not v.passed) and i.verification_status='failed' then
    select * into c
      from public.hq_workforce_execution_compensations
     where intent_id=i.id
     order by created_at desc,id desc limit 1;

    if not found then
      v_classification:='recovery_required';
      v_reason:='verification_failed_recovery_not_yet_evidenced';
      v_terminal:=false;
      v_evidence:=jsonb_build_object('verification_id',v.id,'verification_passed',false,'compensation_evidence_present',false);
    elsif c.authority_grant_id is distinct from i.authority_grant_id
       or c.plan_step_id is distinct from i.plan_step_id
       or c.task_id is distinct from i.task_id
       or c.capability_key is distinct from i.capability_key
       or c.capability_version is distinct from i.capability_version then
      v_classification:='ambiguous_evidence';
      v_reason:='compensation_lineage_mismatch';
      v_escalate:=true;
      v_human:=true;
      v_category:='ambiguous_evidence';
      v_evidence:=jsonb_build_object('verification_id',v.id,'compensation_id',c.id,'lineage_match',false);
    elsif c.outcome='compensated' and i.status='compensated' then
      v_classification:='recovered_compensated';
      v_reason:='compensation_completed';
      v_evidence:=jsonb_build_object('verification_id',v.id,'compensation_id',c.id,'compensation_outcome',c.outcome);
    elsif c.outcome='conflict_escalated' then
      v_classification:='state_diverged';
      v_reason:=coalesce(nullif(c.evidence->>'cause',''),'compensation_state_conflict');
      v_escalate:=true;
      v_human:=true;
      v_category:='state_divergence';
      v_evidence:=jsonb_build_object('verification_id',v.id,'compensation_id',c.id,'compensation_evidence',c.evidence,'mutation_applied',false);
    elsif c.outcome='denied' then
      v_classification:='compensation_denied';
      v_reason:=coalesce(nullif(c.evidence->>'cause',''),'compensation_denied');
      v_escalate:=true;
      v_human:=true;
      v_category:='recovery_denied';
      v_evidence:=jsonb_build_object('verification_id',v.id,'compensation_id',c.id,'compensation_evidence',c.evidence,'mutation_applied',false);
    else
      v_classification:='ambiguous_evidence';
      v_reason:='compensation_state_inconsistent';
      v_escalate:=true;
      v_human:=true;
      v_category:='ambiguous_evidence';
      v_evidence:=jsonb_build_object('verification_id',v.id,'compensation_id',c.id,'compensation_outcome',c.outcome,'intent_status',i.status);
    end if;
  else
    v_classification:='ambiguous_evidence';
    v_reason:='verification_state_inconsistent';
    v_escalate:=true;
    v_human:=true;
    v_category:='ambiguous_evidence';
    v_evidence:=jsonb_build_object('verification_id',v.id,'verification_passed',v.passed,'intent_verification_status',i.verification_status,'intent_status',i.status);
  end if;

  -- R1.4.6 deliberately allows no autonomous business-outcome retry. Database serialization
  -- retries happen before a committed outcome and must retry the complete transaction.
  insert into public.hq_workforce_execution_outcomes(
    intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
    classification,reason_code,terminal,retry_allowed,max_retry_attempts,
    escalation_required,human_intervention_required,classified_by,evidence
  ) values(
    i.id,i.task_id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
    v_classification,btrim(v_reason),v_terminal,false,0,v_escalate,v_human,btrim(p_classified_by),v_evidence
  )
  on conflict (intent_id,classification) do nothing
  returning id into v_outcome_id;

  if v_outcome_id is null then
    select id into v_outcome_id
      from public.hq_workforce_execution_outcomes
     where intent_id=i.id and classification=v_classification;
  end if;
  if v_outcome_id is null then raise exception 'outcome_evidence_persistence_failed'; end if;

  if v_escalate then
    insert into public.hq_workforce_execution_escalations(
      outcome_id,intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,
      category,reason_code,human_intervention_required,evidence
    ) values(
      v_outcome_id,i.id,i.task_id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,
      v_category,btrim(v_reason),v_human,v_evidence||jsonb_build_object('authority_effect','none','mutation_authority_granted',false)
    ) on conflict (outcome_id) do nothing;
  end if;

  return jsonb_build_object(
    'outcome_id',v_outcome_id,'classification',v_classification,'terminal',v_terminal,
    'retry_allowed',false,'max_retry_attempts',0,'escalation_required',v_escalate,
    'human_intervention_required',v_human,'reused',false
  );
end $$;

revoke all on function public.hq_workforce_guard_execution_outcome_immutable() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_guard_execution_escalation_immutable() from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_classify_execution_outcome(uuid,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_classify_execution_outcome(uuid,text) to service_role;

-- Gate invariant: classification/escalation is evidence only and cannot activate authority.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.6 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'WE-R1.4.6 violated fail-closed runtime boundary'; end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.6 cannot activate capability authority'; end if;
end $$;
