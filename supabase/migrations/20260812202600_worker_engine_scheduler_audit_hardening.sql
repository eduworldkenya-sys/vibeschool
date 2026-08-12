-- Governed autonomous scheduler (disabled by default) + append-only evidence guards.

alter table public.hq_workforce_engine_contract add column if not exists heartbeat_enabled boolean not null default false;
alter table public.hq_workforce_engine_contract add column if not exists heartbeat_limit integer not null default 20 check(heartbeat_limit between 1 and 100);

create or replace function public.hq_workforce_scheduled_heartbeat()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_enabled boolean; v_limit integer;
begin
 select heartbeat_enabled,heartbeat_limit into v_enabled,v_limit from public.hq_workforce_engine_contract where singleton=true;
 if not coalesce(v_enabled,false) then return jsonb_build_object('status','disabled','mode','deterministic'); end if;
 return public.hq_workforce_autonomous_heartbeat(coalesce(v_limit,20));
end $$;

create or replace function public.hq_workforce_guard_shadow_run_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin raise exception 'worker_shadow_evidence_immutable'; end $$;
drop trigger if exists trg_hq_workforce_guard_shadow_run_mutation on public.hq_workforce_shadow_runs;
create trigger trg_hq_workforce_guard_shadow_run_mutation before update or delete on public.hq_workforce_shadow_runs for each row execute function public.hq_workforce_guard_shadow_run_mutation();

create or replace function public.hq_workforce_guard_task_verification_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin raise exception 'worker_task_verification_immutable'; end $$;
drop trigger if exists trg_hq_workforce_guard_task_verification_mutation on public.hq_workforce_task_verifications;
create trigger trg_hq_workforce_guard_task_verification_mutation before update or delete on public.hq_workforce_task_verifications for each row execute function public.hq_workforce_guard_task_verification_mutation();

create or replace function public.hq_workforce_guard_heartbeat_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then raise exception 'worker_heartbeat_delete_forbidden'; end if;
 if new.heartbeat_key<>old.heartbeat_key or new.started_at<>old.started_at then raise exception 'worker_heartbeat_identity_immutable'; end if;
 if old.completed_at is not null and new is distinct from old then raise exception 'completed_worker_heartbeat_immutable'; end if;
 return new;
end $$;
drop trigger if exists trg_hq_workforce_guard_heartbeat_mutation on public.hq_workforce_heartbeat_runs;
create trigger trg_hq_workforce_guard_heartbeat_mutation before update or delete on public.hq_workforce_heartbeat_runs for each row execute function public.hq_workforce_guard_heartbeat_mutation();

create or replace function public.hq_workforce_guard_model_invocation_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then raise exception 'worker_model_invocation_delete_forbidden'; end if;
 if (new.worker_key,new.task_id,new.reason_code,new.deterministic_attempted,new.deterministic_failure_evidence,new.model_key,new.token_budget,new.created_at,new.budget_id)
    is distinct from
    (old.worker_key,old.task_id,old.reason_code,old.deterministic_attempted,old.deterministic_failure_evidence,old.model_key,old.token_budget,old.created_at,old.budget_id) then raise exception 'worker_model_invocation_contract_immutable'; end if;
 if old.status<>new.status and not (old.status='authorized' and new.status in ('completed','failed')) then raise exception 'illegal_model_invocation_status_transition'; end if;
 if old.status in ('completed','failed') and new is distinct from old then raise exception 'completed_model_invocation_immutable'; end if;
 return new;
end $$;
drop trigger if exists trg_hq_workforce_guard_model_invocation_mutation on public.hq_workforce_model_invocations;
create trigger trg_hq_workforce_guard_model_invocation_mutation before update or delete on public.hq_workforce_model_invocations for each row execute function public.hq_workforce_guard_model_invocation_mutation();

create or replace function public.hq_workforce_guard_tool_contract_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' and old.status<>'draft' then raise exception 'approved_tool_contract_delete_forbidden'; end if;
 if tg_op='UPDATE' and old.status<>'draft' then
  if (new.tool_key,new.version,new.title,new.handler_key,new.required_capability_key,new.operation,new.resource_type,new.side_effect_class,new.approved_at,new.created_at)
     is distinct from
     (old.tool_key,old.version,old.title,old.handler_key,old.required_capability_key,old.operation,old.resource_type,old.side_effect_class,old.approved_at,old.created_at) then raise exception 'approved_tool_contract_immutable'; end if;
  if old.status<>new.status and not (old.status='approved' and new.status in ('superseded','revoked')) then raise exception 'illegal_tool_contract_status_transition'; end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists trg_hq_workforce_guard_tool_contract_mutation on public.hq_workforce_tool_contracts;
create trigger trg_hq_workforce_guard_tool_contract_mutation before update or delete on public.hq_workforce_tool_contracts for each row execute function public.hq_workforce_guard_tool_contract_mutation();

revoke all on function public.hq_workforce_scheduled_heartbeat(),public.hq_workforce_guard_shadow_run_mutation(),public.hq_workforce_guard_task_verification_mutation(),public.hq_workforce_guard_heartbeat_mutation(),public.hq_workforce_guard_model_invocation_mutation(),public.hq_workforce_guard_tool_contract_mutation() from public,anon,authenticated;
grant execute on function public.hq_workforce_scheduled_heartbeat(),public.hq_workforce_guard_shadow_run_mutation(),public.hq_workforce_guard_task_verification_mutation(),public.hq_workforce_guard_heartbeat_mutation(),public.hq_workforce_guard_model_invocation_mutation(),public.hq_workforce_guard_tool_contract_mutation() to service_role;

do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.unschedule(jobid) from cron.job where jobname='vibeschool-worker-engine-heartbeat';
  perform cron.schedule('vibeschool-worker-engine-heartbeat','* * * * *',$cron$select public.hq_workforce_scheduled_heartbeat();$cron$);
 end if;
end $$;
