-- WE Production Readiness: preserve live-safe legacy safe-queue semantics on clean rebuilds.
-- Non-activating. Transitional compatibility only. This function MUST NOT become a consequential business-resource gateway.

create or replace function public.hq_workforce_execute_safe_queue()
returns integer
language plpgsql
security invoker
set search_path=public
as $$
declare
  r record;
  n integer:=0;
begin
  for r in
    select wr.id,
           wr.work_item_id,
           wr.lane_key,
           wr.worker_id,
           w.worker_key,
           wi.title,
           wi.work_type,
           s.skill_key,
           s.execution_method
      from public.hq_workforce_runs wr
      join public.hq_workforce_workers w on w.id=wr.worker_id
      join public.hq_workforce_skills s on s.id=wr.skill_id
      left join public.hq_work_items wi on wi.id=wr.work_item_id
     where wr.status='queued'
       and wr.authority_result='allow'
       and s.execution_method in ('none','local_algorithm')
  loop
    update public.hq_workforce_runs
       set status='running',
           started_at=now()
     where id=r.id;

    update public.hq_workforce_runs
       set status='completed',
           completed_at=now(),
           execution_evidence=execution_evidence||jsonb_build_object(
             'execution_method',r.execution_method,
             'skill_key',r.skill_key,
             'action','internal_review_only',
             'worker_key',r.worker_key,
             'side_effects','none',
             'completed_at',now()
           )
     where id=r.id;

    update public.hq_work_items
       set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object(
             'workforce_lane',r.lane_key,
             'worker_key',r.worker_key,
             'skill_key',r.skill_key,
             'action','internal_review_only',
             'side_effects','none'
           ),
           acted_at=coalesce(acted_at,now()),
           updated_at=now()
     where id=r.work_item_id;

    n:=n+1;
  end loop;

  return n;
end
$$;

revoke all on function public.hq_workforce_execute_safe_queue() from public,anon,authenticated;
grant execute on function public.hq_workforce_execute_safe_queue() to service_role;

comment on function public.hq_workforce_execute_safe_queue() is
'LEGACY TRANSITIONAL INTERNAL-REVIEW EXECUTOR ONLY. No consequential business-resource side effects are permitted. Production-readiness contract requires retirement from scheduled execution when the canonical R1.4 consequential gateway is production-reconciled.';

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.hq_workforce_execute_safe_queue()'::regprocedure) into v_def;
  if v_def not ilike '%internal_review_only%'
     or v_def not ilike '%side_effects%none%'
     or v_def not ilike '%execution_method in (''none'',''local_algorithm'')%'
  then
    raise exception 'legacy_safe_queue_hardening_contract_missing';
  end if;
end
$$;
