-- Worker Engine production-promotion fail-closed hardening.
-- Runtime promotion and autonomy activation are intentionally separate.
-- This migration must leave both activation flags OFF and no Worker Engine cron schedule.

update public.hq_workforce_engine_contract
set heartbeat_enabled = false,
    factory_enabled = false,
    updated_at = clock_timestamp()
where singleton = true;

-- Remove the historical scheduler registered by WE-L6/WE-L11 if pg_cron is present.
-- Use the supported pg_cron function rather than mutating cron.job directly.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (
       select 1
       from cron.job
       where jobname = 'vibeschool-worker-engine-heartbeat'
     ) then
    perform cron.unschedule('vibeschool-worker-engine-heartbeat');
  end if;
end
$$;

-- Production forensics found two legacy probation authority routines that are
-- production-only drift, plus the historical bulk certifier. Clean replay may
-- not contain the production-only routines, so revoke them conditionally.
do $$
begin
  if to_regprocedure('public.hq_workforce_create_probation_worker(text,text,text,jsonb)') is not null then
    execute 'revoke execute on function public.hq_workforce_create_probation_worker(text,text,text,jsonb) from service_role';
  end if;

  if to_regprocedure('public.hq_workforce_certify_probation_worker(uuid,text)') is not null then
    execute 'revoke execute on function public.hq_workforce_certify_probation_worker(uuid,text) from service_role';
  end if;

  if to_regprocedure('public.hq_workforce_certify_probation_workers()') is not null then
    execute 'revoke execute on function public.hq_workforce_certify_probation_workers() from service_role';
  end if;
end
$$;
