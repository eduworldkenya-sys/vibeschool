-- Task 11 reliability repair: HQ company-intelligence scheduling must not invoke
-- the retired legacy Worker executor. Worker execution remains exclusively owned
-- by the governed Task-10 / WE-R1.4 gateways.

begin;

do $$
begin
  if to_regprocedure('public.hq_run_operating_cycle()') is null
     or to_regprocedure('public.hq_run_company_intelligence_v2()') is null then
    return;
  end if;

  execute $fn$
    create or replace function public.hq_run_operating_cycle()
    returns jsonb
    language plpgsql
    security definer
    set search_path=public
    as $body$
    declare
      intel jsonb;
      rec jsonb;
      pf uuid;
      sec jsonb;
      verify jsonb;
      journeys jsonb;
      routed integer;
    begin
      perform public.hq_assert_owner();
      intel := public.hq_run_company_intelligence_v2();
      pf := public.hq_detect_policy_failure_burst();
      sec := public.hq_detect_security_signals();
      rec := public.hq_reconcile_findings();
      routed := public.hq_route_work_items();
      verify := public.hq_reconcile_product_event_verifications();
      journeys := public.hq_run_control_journeys();

      return jsonb_build_object(
        'intelligence', intel,
        'policyFailureFinding', pf,
        'security', sec,
        'reconciliation', rec,
        'routedWorkItems', routed,
        'workerExecution', 'governed_separately_by_we_r1_4',
        'productVerification', verify,
        'controlJourneys', journeys,
        'completed_at', now()
      );
    end
    $body$
  $fn$;

  revoke all on function public.hq_run_operating_cycle() from public, anon;
  grant execute on function public.hq_run_operating_cycle() to authenticated;
  comment on function public.hq_run_operating_cycle() is
    'Owner-gated deterministic HQ operating cycle. Does not execute retired or current Worker gateways; Worker execution is governed separately by Task 10 / WE-R1.4.';
end $$;

-- Production owns this historical pg_cron row. Clean reconstruction may not, so
-- the repair is intentionally conditional and portable.
do $$
declare
  v_jobid bigint;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  select jobid into v_jobid
  from cron.job
  where jobname = 'vibeschool-hq-company-intelligence';

  if v_jobid is null then
    return;
  end if;

  if to_regprocedure('public.hq_run_company_intelligence_v2()') is null then
    raise exception 'TASK11: company-intelligence cron exists but canonical intelligence function is missing';
  end if;

  perform cron.alter_job(
    v_jobid,
    command := 'select public.hq_run_company_intelligence_v2();'
  );

  if exists (
    select 1 from cron.job
    where jobid = v_jobid
      and command is distinct from 'select public.hq_run_company_intelligence_v2();'
  ) then
    raise exception 'TASK11: company-intelligence cron repair did not persist';
  end if;
end $$;

commit;
