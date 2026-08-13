-- Worker Engine production-promotion separation hardening.
-- Runtime/schema promotion must remain mechanically separate from autonomy activation.
-- This migration is intentionally fail-closed and safe on clean replay where
-- production-only legacy routines may not exist.

-- Never inherit an enabled runtime/factory switch through schema promotion.
update public.hq_workforce_engine_contract
set heartbeat_enabled = false,
    factory_enabled = false,
    updated_at = clock_timestamp()
where singleton = true;

-- Historical WE-L6 scheduler hardening may have registered this job when pg_cron
-- is installed. Promotion must end unscheduled; activation is a later decision.
-- Guard the actual relation, not only the schema: preview/local environments can
-- expose a cron schema without cron.job being present.
do $$
declare
  v_job record;
begin
  if to_regclass('cron.job') is not null then
    for v_job in execute
      'select jobid from cron.job where jobname = $1'
      using 'vibeschool-worker-engine-heartbeat'
    loop
      perform cron.unschedule(v_job.jobid);
    end loop;
  end if;
end
$$;

-- Close legacy worker creation/certification authority paths. Two of these
-- routines are production-derived and may not exist on a blank replay, so use
-- to_regprocedure guards rather than assuming repository presence.
do $$
begin
  if to_regprocedure('public.hq_workforce_create_probation_worker(text,text,text,jsonb)') is not null then
    execute 'revoke execute on function public.hq_workforce_create_probation_worker(text,text,text,jsonb) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.hq_workforce_certify_probation_worker(uuid,text)') is not null then
    execute 'revoke execute on function public.hq_workforce_certify_probation_worker(uuid,text) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.hq_workforce_certify_probation_workers()') is not null then
    execute 'revoke execute on function public.hq_workforce_certify_probation_workers() from public, anon, authenticated, service_role';
  end if;
end
$$;
