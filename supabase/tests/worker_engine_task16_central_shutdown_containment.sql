-- TASK 16: centralized shutdown containment contract.
begin;

do $$
declare d text;
begin
  select lower(pg_get_functiondef('public.hq_workforce_contain_all_pending_tasks_on_safe_off()'::regprocedure)) into d;
  if position('t.status in (''queued'',''running'')' in d)=0 then
    raise exception 'task16_shutdown_does_not_contain_unbound_queue';
  end if;
  if position('new.runtime_state_version<=old.runtime_state_version' in d)=0 then
    raise exception 'task16_shutdown_containment_not_version_bound';
  end if;
  if position('runtime_shutdown_post_commit_verification_required' in d)=0 then
    raise exception 'task16_shutdown_loses_committed_uncertainty';
  end if;
  if position('global_stop_contained' in d)=0 or position('runtime_stop_contained' in d)=0 then
    raise exception 'task16_shutdown_reason_evidence_missing';
  end if;
end $$;

do $$
declare d text;
begin
  if not exists(select 1 from pg_trigger where tgrelid='public.hq_workforce_engine_contract'::regclass and tgname='trg_hq_workforce_contain_all_pending_tasks_on_safe_off' and not tgisinternal) then
    raise exception 'task16_authoritative_shutdown_trigger_missing';
  end if;
  select lower(pg_get_functiondef('public.hq_workforce_contain_content_research_on_task_shutdown()'::regprocedure)) into d;
  if position('content.research.execute' in d)=0 or position('needs_human' in d)=0 then
    raise exception 'task16_content_research_quarantine_missing';
  end if;
  if position('hq_workforce_release_budget' in d)=0 or position('budget_release_error' in d)=0 then
    raise exception 'task16_domain_budget_release_evidence_missing';
  end if;
  if position('domain_containment' in d)=0 then raise exception 'task16_domain_containment_evidence_missing'; end if;
end $$;

do $$
begin
  if not exists(select 1 from pg_trigger where tgrelid='public.hq_workforce_task_contracts'::regclass and tgname='trg_hq_workforce_contain_content_research_on_task_shutdown' and not tgisinternal) then
    raise exception 'task16_content_research_shutdown_trigger_missing';
  end if;
end $$;

rollback;