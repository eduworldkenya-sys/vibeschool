-- Worker Engine P1 hardening against the actual R1.4 production architecture.
-- Existing controls already provide fail-closed context scopes, deterministic-first
-- model authorization, certification checks, paid-AI gating, runtime budgets and
-- worker performance telemetry. This migration adds the missing explicit fallback
-- decision contract instead of introducing the superseded hq_worker_* schema.

alter table public.hq_workforce_model_invocations
  add column if not exists original_risk_class smallint,
  add column if not exists fallback_risk_class smallint,
  add column if not exists fallback_depth integer,
  add column if not exists fallback_decision text;

alter table public.hq_workforce_model_invocations
  drop constraint if exists hq_workforce_model_invocations_fallback_decision_check;

alter table public.hq_workforce_model_invocations
  add constraint hq_workforce_model_invocations_fallback_decision_check
  check (fallback_decision is null or fallback_decision in ('allow','approval_required','blocked'));

alter table public.hq_workforce_model_invocations
  add constraint hq_workforce_model_invocations_fallback_depth_check
  check (fallback_depth is null or fallback_depth > 0);

create index if not exists hq_workforce_model_invocations_fallback_idx
  on public.hq_workforce_model_invocations(worker_key, created_at desc)
  where fallback_depth is not null;

create or replace function public.hq_workforce_authorize_model_fallback(
  p_worker_key text,
  p_task_id uuid,
  p_reason_code text,
  p_failure_evidence jsonb,
  p_model_key text,
  p_token_budget bigint,
  p_original_risk_class smallint,
  p_fallback_risk_class smallint,
  p_fallback_depth integer default 1,
  p_max_fallback_depth integer default 1,
  p_require_approval_on_risk_increase boolean default true
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_id uuid;
  v_decision text := 'allow';
begin
  perform public.hq_workforce_assert_identity(p_worker_key);
  perform public.hq_workforce_assert_certification(p_worker_key);
  if public.hq_workforce_current_lifecycle_state(p_worker_key) <> 'active' then
    raise exception 'worker_not_active';
  end if;
  if p_reason_code not in ('semantic_ambiguity','unstructured_synthesis','novel_classification') then
    raise exception 'model_reason_not_allowlisted';
  end if;
  if coalesce(p_failure_evidence,'{}'::jsonb) = '{}'::jsonb then
    raise exception 'deterministic_failure_evidence_required';
  end if;
  if p_token_budget < 1 then
    raise exception 'model_token_budget_required';
  end if;
  if p_original_risk_class is null or p_fallback_risk_class is null then
    raise exception 'fallback_risk_class_required';
  end if;
  if p_fallback_depth < 1 or p_fallback_depth > coalesce(p_max_fallback_depth,1) then
    v_decision := 'blocked';
  elsif p_fallback_risk_class > p_original_risk_class and coalesce(p_require_approval_on_risk_increase,true) then
    v_decision := 'approval_required';
  end if;

  if v_decision = 'approval_required' then
    insert into public.hq_workforce_model_invocations(
      worker_key,task_id,reason_code,deterministic_attempted,deterministic_failure_evidence,
      model_key,token_budget,status,original_risk_class,fallback_risk_class,fallback_depth,fallback_decision
    ) values (
      p_worker_key,p_task_id,p_reason_code,true,p_failure_evidence,
      p_model_key,p_token_budget,'denied',p_original_risk_class,p_fallback_risk_class,p_fallback_depth,v_decision
    ) returning id into v_id;
    return v_id;
  end if;

  if v_decision = 'blocked' then
    insert into public.hq_workforce_model_invocations(
      worker_key,task_id,reason_code,deterministic_attempted,deterministic_failure_evidence,
      model_key,token_budget,status,original_risk_class,fallback_risk_class,fallback_depth,fallback_decision
    ) values (
      p_worker_key,p_task_id,p_reason_code,true,p_failure_evidence,
      p_model_key,p_token_budget,'denied',p_original_risk_class,p_fallback_risk_class,p_fallback_depth,v_decision
    ) returning id into v_id;
    return v_id;
  end if;

  perform public.hq_workforce_reserve_budget(p_worker_key,'model_tokens',p_token_budget);
  insert into public.hq_workforce_model_invocations(
    worker_key,task_id,reason_code,deterministic_attempted,deterministic_failure_evidence,
    model_key,token_budget,status,original_risk_class,fallback_risk_class,fallback_depth,fallback_decision
  ) values (
    p_worker_key,p_task_id,p_reason_code,true,p_failure_evidence,
    p_model_key,p_token_budget,'authorized',p_original_risk_class,p_fallback_risk_class,p_fallback_depth,v_decision
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.hq_workforce_authorize_model_fallback(text,uuid,text,jsonb,text,bigint,smallint,smallint,integer,integer,boolean)
  from public,anon,authenticated;
grant execute on function public.hq_workforce_authorize_model_fallback(text,uuid,text,jsonb,text,bigint,smallint,smallint,integer,integer,boolean)
  to service_role;
