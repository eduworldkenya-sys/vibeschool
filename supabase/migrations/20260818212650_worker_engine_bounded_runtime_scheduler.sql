-- access: service-only public.hq_workforce_runtime_capability_allowlist
-- authorization-test: public.hq_workforce_runtime_capability_allowlist
create table if not exists public.hq_workforce_runtime_capability_allowlist (
  capability_key text not null,
  capability_version integer not null check (capability_version>0),
  max_autonomy_level smallint not null check (max_autonomy_level between 0 and 2),
  max_risk_class smallint not null check (max_risk_class between 0 and 2),
  operation text not null,
  resource_type text not null,
  enabled boolean not null default true,
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(capability_key,capability_version,operation,resource_type)
);
alter table public.hq_workforce_runtime_capability_allowlist enable row level security;
revoke all on table public.hq_workforce_runtime_capability_allowlist from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_runtime_capability_allowlist to service_role;

insert into public.hq_workforce_runtime_capability_allowlist(
  capability_key,capability_version,max_autonomy_level,max_risk_class,operation,resource_type,enabled,reason
) values
  ('internal.work_queue.prioritize',1,2,1,'update_priority','hq_work_items',true,'Certified reversible priority-only canary; exact one-row blast radius with verification and compensation.'),
  ('content.research.execute',1,1,1,'research','curriculum_research_job',true,'Research-only evidence discovery; cannot publish or mutate learner/product truth.'),
  ('content.evidence.semantic_verify',1,1,1,'verify_semantics','curriculum_intelligence_source',true,'Evidence verification only; immutable verdict path and no publication authority.'),
  ('content.authoring.source_grounded',1,1,1,'draft_content','curriculum_intelligence_proposal',true,'Human-review-only draft generation; acceptance/apply/publish remain separate owner-governed operations.')
on conflict(capability_key,capability_version,operation,resource_type) do update
set max_autonomy_level=excluded.max_autonomy_level,
    max_risk_class=excluded.max_risk_class,
    enabled=excluded.enabled,
    reason=excluded.reason,
    updated_at=clock_timestamp();

create or replace function public.hq_workforce_execute_bounded_runtime_queue(
  p_limit integer default 10,
  p_lease_seconds integer default 120
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  r record;
  n integer:=0;
  v_completed integer:=0;
  v_failed integer:=0;
  v_dead integer:=0;
  evidence jsonb;
  err text;
begin
  if p_limit<1 or p_limit>50 then raise exception 'bounded_queue_limit_invalid'; end if;
  if p_lease_seconds<30 or p_lease_seconds>900 then raise exception 'bounded_queue_lease_invalid'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'worker_engine_contract_missing'; end if;
  if not coalesce(ec.runtime_execution_enabled,false) then
    return jsonb_build_object('status','disabled','reason','runtime_execution_off','processed',0,'consequential_execution',false);
  end if;
  if coalesce(ec.runtime_anomaly_paused,false) then
    return jsonb_build_object('status','paused','reason','runtime_anomaly_paused','processed',0,'consequential_execution',false);
  end if;
  if ec.runtime_autonomy_level not between 1 and 2 or ec.runtime_max_risk not between 0 and 2 then
    raise exception 'bounded_scheduler_runtime_ceiling_invalid:L%:R%',ec.runtime_autonomy_level,ec.runtime_max_risk;
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('worker-engine|bounded-runtime-scheduler',0)) then
    return jsonb_build_object('status','busy','processed',0,'consequential_execution',false);
  end if;
  update public.hq_workforce_task_contracts
     set status='queued',lease_expires_at=null,last_error=coalesce(last_error||'; ','')||'lease_expired_recovered'
   where status='running' and lease_expires_at<clock_timestamp();
  for r in
    select t.id
    from public.hq_workforce_task_contracts t
    join public.hq_workforce_plan_steps ps on ps.id=t.plan_step_id
    join public.hq_workforce_plans p on p.id=ps.plan_id
    join public.hq_workforce_objectives o on o.id=p.objective_id
    join public.hq_workforce_runtime_capability_allowlist a
      on a.capability_key=t.capability_key and a.capability_version=t.capability_version and a.operation=t.operation and a.resource_type=t.resource_type and a.enabled
    where t.status='queued' and t.next_attempt_at<=clock_timestamp() and t.attempt_count<t.max_attempts
      and ps.required_autonomy<=ec.runtime_autonomy_level and ps.required_risk<=ec.runtime_max_risk
      and a.max_autonomy_level>=ps.required_autonomy and a.max_risk_class>=ps.required_risk
      and o.status='approved' and p.status='selected' and (o.deadline is null or o.deadline>clock_timestamp())
    order by o.deadline asc nulls last, t.created_at asc, t.id
    for update of t skip locked
    limit p_limit
  loop
    update public.hq_workforce_task_contracts
       set status='running',attempt_count=attempt_count+1,started_at=coalesce(started_at,clock_timestamp()),
           lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),last_error=null
     where id=r.id;
    begin
      evidence:=public.hq_workforce_tool_gateway_execute(r.id);
      if coalesce(evidence->>'decision','allow')='deny' then
        update public.hq_workforce_task_contracts set status='failed',lease_expires_at=null,completed_at=null,execution_evidence=evidence,last_error='execution_denied:'||coalesce(evidence->>'reason','unspecified') where id=r.id;
        v_failed:=v_failed+1;
      else
        update public.hq_workforce_task_contracts set status='completed',completed_at=clock_timestamp(),lease_expires_at=null,execution_evidence=evidence,last_error=null where id=r.id;
        v_completed:=v_completed+1;
      end if;
    exception when others then
      err:=sqlerrm;
      update public.hq_workforce_task_contracts
         set status=case when attempt_count>=max_attempts then 'dead_letter' else 'queued' end,
             next_attempt_at=case when attempt_count>=max_attempts then next_attempt_at else clock_timestamp()+make_interval(secs=>least(300,5*(2^greatest(attempt_count-1,0))::integer)) end,
             lease_expires_at=null,last_error=err
       where id=r.id;
      if (select status='dead_letter' from public.hq_workforce_task_contracts where id=r.id) then
        insert into public.hq_workforce_dead_letters(task_id,worker_key,error_code,error_detail,attempts,payload_snapshot)
        select id,worker_key,'BOUNDED_RUNTIME_EXECUTION_FAILED',err,attempt_count,payload from public.hq_workforce_task_contracts where id=r.id
        on conflict(task_id) do update set error_code=excluded.error_code,error_detail=excluded.error_detail,attempts=excluded.attempts,payload_snapshot=excluded.payload_snapshot,created_at=clock_timestamp();
        v_dead:=v_dead+1;
      else v_failed:=v_failed+1; end if;
    end;
    n:=n+1;
  end loop;
  return jsonb_build_object('status','completed','processed',n,'completed',v_completed,'failed_or_retrying',v_failed,'dead_lettered',v_dead,'runtime_autonomy_level',ec.runtime_autonomy_level,'runtime_max_risk',ec.runtime_max_risk,'consequential_execution',n>0);
end $$;

create or replace function public.hq_workforce_scheduled_bounded_runtime_queue()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  return public.hq_workforce_execute_bounded_runtime_queue(10,120);
exception when others then
  return jsonb_build_object('status','failed_closed','error',sqlerrm,'processed',0,'consequential_execution',false);
end $$;

revoke all on function public.hq_workforce_execute_bounded_runtime_queue(integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_scheduled_bounded_runtime_queue() from public,anon,authenticated,service_role;

do $$
declare v_job bigint;
begin
  for v_job in select jobid from cron.job where jobname='worker-engine-bounded-runtime-scheduler' loop
    perform cron.unschedule(v_job);
  end loop;
  perform cron.schedule('worker-engine-bounded-runtime-scheduler','* * * * *',$cron$select public.hq_workforce_scheduled_bounded_runtime_queue();$cron$);
end $$;

comment on function public.hq_workforce_scheduled_bounded_runtime_queue() is
'Fail-closed pg_cron entrypoint. It is inert while runtime is OFF and can process only explicitly allowlisted certified L1/L2 capabilities inside current autonomy/risk ceilings.';
