-- TASK 16: centralized shutdown containment.
-- Authority is resolved lazily, so queued tasks may have no grant ID yet. Any governed
-- transition to a newer OFF state must terminalize all queued/running Worker Engine work,
-- preventing stale queued work from silently resurrecting on a later activation.

create or replace function public.hq_workforce_contain_content_research_on_task_shutdown()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_job_id uuid;
  j public.curriculum_research_jobs%rowtype;
  v_budget_released boolean:=false;
  v_budget_error text;
begin
  if old.status<>'running' or new.status not in ('cancelled','failed','dead_letter')
     or old.capability_key<>'content.research.execute' then
    return new;
  end if;

  begin v_job_id:=(old.payload->>'research_job_id')::uuid;
  exception when others then v_job_id:=null; end;
  if v_job_id is null then return new; end if;

  select * into j from public.curriculum_research_jobs where id=v_job_id for update;
  if not found or j.status<>'running' then return new; end if;

  if j.workforce_budget_reservation_id is not null then
    begin
      perform public.hq_workforce_release_budget(j.workforce_budget_reservation_id,old.budget_amount);
      v_budget_released:=true;
    exception when others then
      v_budget_error:=left(sqlerrm,500);
      v_budget_released:=false;
    end;
  else
    v_budget_released:=true;
  end if;

  update public.curriculum_research_jobs set
    status='needs_human',claimed_at=null,claimed_by=null,
    workforce_budget_reservation_id=case when v_budget_released then null else workforce_budget_reservation_id end,
    execution_metadata=coalesce(execution_metadata,'{}'::jsonb)||jsonb_build_object(
      'runtime_shutdown',jsonb_build_object(
        'task_id',old.id,'at',clock_timestamp(),'budget_released',v_budget_released,
        'budget_release_error',v_budget_error,'containment','quarantine_needs_human'
      )
    ),
    updated_at=clock_timestamp()
  where id=j.id;

  new.execution_evidence:=coalesce(new.execution_evidence,'{}'::jsonb)||jsonb_build_object(
    'domain_containment',jsonb_build_object(
      'resource_type','curriculum_research_job','resource_id',j.id,
      'status','needs_human','budget_released',v_budget_released,'budget_release_error',v_budget_error
    )
  );
  if not v_budget_released then
    new.last_error:=coalesce(new.last_error,'runtime_shutdown_domain_budget_release_requires_review');
  end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_contain_content_research_on_task_shutdown
  on public.hq_workforce_task_contracts;
create trigger trg_hq_workforce_contain_content_research_on_task_shutdown
before update of status on public.hq_workforce_task_contracts
for each row execute function public.hq_workforce_contain_content_research_on_task_shutdown();

create or replace function public.hq_workforce_contain_all_pending_tasks_on_safe_off()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_global_stop boolean:=false; v_reason text;
begin
  if new.runtime_state<>'OFF' or new.runtime_execution_enabled
     or new.runtime_state_version<=old.runtime_state_version then
    return new;
  end if;

  select exists(
    select 1 from public.hq_workforce_execution_breakers
     where scope_type='global' and scope_ref='global' and status='tripped'
  ) into v_global_stop;
  v_reason:=case when v_global_stop then 'global_stop_contained' else 'runtime_stop_contained' end;

  update public.hq_workforce_task_contracts t set
    status=case when t.status='running' and exists(
      select 1 from public.hq_workforce_execution_intents ei where ei.task_id=t.id and ei.status='committed'
    ) then 'failed' else 'cancelled' end,
    completed_at=clock_timestamp(),lease_expires_at=null,
    last_error=case when t.status='running' and exists(
      select 1 from public.hq_workforce_execution_intents ei where ei.task_id=t.id and ei.status='committed'
    ) then 'runtime_shutdown_post_commit_verification_required' else v_reason end,
    execution_evidence=coalesce(t.execution_evidence,'{}'::jsonb)||jsonb_build_object(
      'central_shutdown_containment',jsonb_build_object(
        'runtime_state_version',new.runtime_state_version,'global_stop_active',v_global_stop,
        'reason',v_reason,'at',clock_timestamp()
      )
    )
  where t.status in ('queued','running');

  return new;
end $$;

drop trigger if exists trg_hq_workforce_contain_all_pending_tasks_on_safe_off
  on public.hq_workforce_engine_contract;
create trigger trg_hq_workforce_contain_all_pending_tasks_on_safe_off
before update on public.hq_workforce_engine_contract
for each row execute function public.hq_workforce_contain_all_pending_tasks_on_safe_off();

revoke all on function public.hq_workforce_contain_content_research_on_task_shutdown()
  from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_contain_all_pending_tasks_on_safe_off()
  from public,anon,authenticated,service_role;
