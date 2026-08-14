-- WE-R1.3 scheduler fail-closed correction.
-- Persist anomaly/pause evidence instead of raising inside the same transaction and rolling the evidence back.
-- Still no cron, no activation and no consequential execution.

create or replace function public.hq_workforce_run_shadow_cycle(p_cycle_key text, p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  w public.hq_work_items%rowtype;
  fp text;
  inserted_count integer:=0;
  duplicate_count integer:=0;
  queue_depth integer;
  window_start timestamptz:=date_trunc('hour',clock_timestamp());
  cycles_this_hour integer;
begin
  if p_limit<1 or p_limit>100 then raise exception 'shadow_cycle_limit_invalid'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if not ec.shadow_enabled or not ec.shadow_scheduler_enabled or ec.shadow_global_stop then raise exception 'shadow_scheduler_global_stop'; end if;
  if ec.shadow_anomaly_paused then
    return jsonb_build_object('mode','shadow','cycle_key',p_cycle_key,'status','paused','reason','shadow_scheduler_anomaly_paused','consequential_execution',false);
  end if;
  if ec.runtime_execution_enabled or ec.runtime_autonomy_level>0 then raise exception 'shadow_requires_consequential_runtime_off'; end if;

  select count(*) into cycles_this_hour from public.hq_workforce_shadow_resource_usage
   where resource_kind='cycle' and window_started_at=window_start;
  if cycles_this_hour>=ec.shadow_max_cycles_per_hour then
    insert into public.hq_workforce_shadow_anomalies(anomaly_key,severity,action,details)
    values('cycle_rate_ceiling','high','pause',jsonb_build_object('cycle_key',p_cycle_key,'count',cycles_this_hour,'ceiling',ec.shadow_max_cycles_per_hour));
    update public.hq_workforce_engine_contract set shadow_anomaly_paused=true,updated_at=clock_timestamp() where singleton=true;
    return jsonb_build_object('mode','shadow','cycle_key',p_cycle_key,'status','paused','reason','cycle_rate_ceiling','consequential_execution',false);
  end if;

  select count(*) into queue_depth from public.hq_workforce_shadow_candidates where status in ('candidate','recommended','escalated');
  if queue_depth>=ec.shadow_max_queue_depth then
    insert into public.hq_workforce_shadow_anomalies(anomaly_key,severity,action,details)
    values('queue_depth_ceiling','critical','pause',jsonb_build_object('cycle_key',p_cycle_key,'depth',queue_depth,'ceiling',ec.shadow_max_queue_depth));
    update public.hq_workforce_engine_contract set shadow_anomaly_paused=true,updated_at=clock_timestamp() where singleton=true;
    return jsonb_build_object('mode','shadow','cycle_key',p_cycle_key,'status','paused','reason','queue_depth_ceiling','consequential_execution',false);
  end if;

  insert into public.hq_workforce_shadow_resource_usage(resource_kind,window_started_at,amount)
  values('cycle',window_start,1);

  for w in
    select * from public.hq_work_items
    where status='open'
    order by case priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end, created_at
    limit least(p_limit,ec.shadow_max_candidates_per_cycle)
  loop
    fp:=public.hq_workforce_shadow_candidate_fingerprint(w);
    begin
      insert into public.hq_workforce_shadow_candidates(
        source_work_item_id,candidate_fingerprint,lane_key,scope_type,scope_ref,priority,sla_due_at,status,reasoning_summary
      ) values(
        w.id,fp,w.department_key,'platform_internal',jsonb_build_object('work_item_id',w.id),
        case w.priority when 'critical' then 100 when 'high' then 75 when 'normal' then 50 else 25 end,
        w.due_at,'candidate','Detected from open HQ internal work item; no consequential action performed.'
      );
      inserted_count:=inserted_count+1;
      insert into public.hq_workforce_shadow_resource_usage(resource_kind,window_started_at,amount)
      values('candidate',window_start,1);
    exception when unique_violation then
      duplicate_count:=duplicate_count+1;
    end;
  end loop;

  return jsonb_build_object(
    'mode','shadow','cycle_key',p_cycle_key,'status','completed','inserted',inserted_count,
    'duplicates',duplicate_count,'consequential_execution',false
  );
end $$;

revoke all on function public.hq_workforce_run_shadow_cycle(text,integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_run_shadow_cycle(text,integer) to service_role;
