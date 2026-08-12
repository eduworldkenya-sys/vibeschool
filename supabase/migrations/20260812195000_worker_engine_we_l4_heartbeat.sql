-- Worker Engine WE-L4: bounded autonomous heartbeat.
-- access: service-only public.hq_workforce_heartbeat_runs
-- authorization-test: public.hq_workforce_heartbeat_runs anon/authenticated denied; service_role only.

create table public.hq_workforce_heartbeat_runs (
 id bigint generated always as identity primary key, heartbeat_key text not null unique,
 started_at timestamptz not null default now(), completed_at timestamptz,
 tasks_processed integer not null default 0, tasks_failed integer not null default 0,
 result jsonb not null default '{}'::jsonb
);

create or replace function public.hq_workforce_autonomous_heartbeat(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_key text; v_processed int; v_failed int; v_result jsonb;
begin
 if p_limit<1 or p_limit>100 then raise exception 'invalid_heartbeat_limit'; end if;
 v_key:='heartbeat:'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');
 insert into public.hq_workforce_heartbeat_runs(heartbeat_key) values(v_key);
 -- fail closed: queue kernel itself rechecks lifecycle, identity, capability, scope and budget for every task.
 v_processed:=public.hq_workforce_execute_task_queue(p_limit,60);
 select count(*) into v_failed from public.hq_workforce_task_contracts where status='dead_letter' and completed_at is null and created_at>=now()-interval '5 minutes';
 v_result:=jsonb_build_object('heartbeat_key',v_key,'processed',v_processed,'recent_dead_letters',v_failed,'mode','deterministic');
 update public.hq_workforce_heartbeat_runs set completed_at=now(),tasks_processed=v_processed,tasks_failed=v_failed,result=v_result where heartbeat_key=v_key;
 return v_result;
end $$;

alter table public.hq_workforce_heartbeat_runs enable row level security;
revoke all on table public.hq_workforce_heartbeat_runs from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.hq_workforce_heartbeat_runs to service_role;
revoke all on function public.hq_workforce_autonomous_heartbeat(integer) from public,anon,authenticated;
grant execute on function public.hq_workforce_autonomous_heartbeat(integer) to service_role;
