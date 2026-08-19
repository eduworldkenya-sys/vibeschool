-- TASK 16: activation-envelope authority/resource evidence contract.
begin;

do $$
declare d text;
begin
  if not exists(
    select 1 from information_schema.columns
     where table_schema='public' and table_name='hq_workforce_runtime_activation_envelopes' and column_name='budget_snapshot'
  ) then raise exception 'task16_budget_snapshot_missing'; end if;

  select lower(pg_get_functiondef('public.hq_workforce_guard_activation_envelope_authority_set()'::regprocedure)) into d;
  if position('runtime_activation_unselected_active_authority_present' in d)=0 then
    raise exception 'task16_hidden_active_authority_not_rejected';
  end if;
  if position('runtime_activation_envelope_selected_authority_not_active' in d)=0 then
    raise exception 'task16_selected_authority_activity_not_verified';
  end if;
  if position('hq_workforce_execution_budgets' in d)=0
     or position('available_amount' in d)=0
     or position('runtime_activation_budget_snapshot_required' in d)=0 then
    raise exception 'task16_budget_snapshot_not_sealed';
  end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_assert_task_in_active_envelope(uuid)'::regprocedure)) into d;
  if position('worker_runtime_unselected_active_authority_detected' in d)=0 then
    raise exception 'task16_runtime_hidden_authority_detector_missing';
  end if;
  if position('g.capability_version=t.capability_version' in d)=0
     or position('g.permitted_worker_key=t.worker_key' in d)=0
     or position('g.scope_type=t.scope_type' in d)=0
     or position('g.scope_ref=t.scope_ref' in d)=0 then
    raise exception 'task16_first_execution_semantic_envelope_match_incomplete';
  end if;
end $$;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_guard_runtime_activation_envelope_budget_immutable()'::regprocedure)) into d;
  if position('budget_snapshot_immutable' in d)=0 then raise exception 'task16_budget_snapshot_mutable'; end if;
end $$;

rollback;