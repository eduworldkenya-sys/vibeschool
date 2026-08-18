-- HQ decision-intelligence production repair.
-- 1) PostgreSQL format() supports %s/%I/%L, not printf precision specifiers.
-- 2) HQ read/report path must not invoke the retired legacy workforce executor.
--
-- Production contains an older company-intelligence-v2 subsystem whose original DDL
-- predates repository tracking. A clean repository rebuild intentionally does not
-- invent that legacy state. Therefore this repair patches the subsystem only when
-- both production functions are present; clean/recovery environments remain portable.

do $$
declare d text;
begin
  if to_regprocedure('public.hq_run_company_intelligence_v2()') is null
     or to_regprocedure('public.hq_get_company_brief_v2()') is null then
    return;
  end if;

  d := pg_get_functiondef('public.hq_run_company_intelligence_v2()'::regprocedure);
  d := replace(d, 'format(''%s users signed up in 7 days but only %s showed post-signup product activity (%.1f%% activation).'',' , 'format(''%s users signed up in 7 days but only %s showed post-signup product activity (%s%% activation).'',' );
  d := replace(d, '100.0*a/greatest(s,1))', 'round(100.0*a/greatest(s,1),1))');
  d := replace(d, 'format(''DAU fell from %s yesterday to %s today (%.1f%% change).'',' , 'format(''DAU fell from %s yesterday to %s today (%s%% change).'',' );
  d := replace(d, '100.0*(dau-ydau)/greatest(ydau,1))', 'round(100.0*(dau-ydau)/greatest(ydau,1),1))');
  d := replace(d, 'format(''Actual %s is behind target %s for metric %s at %.0f%% of the goal period.'',' , 'format(''Actual %s is behind target %s for metric %s at %s%% of the goal period.'',' );
  d := replace(d, 'elapsed*100)', 'round(elapsed*100,0))');
  execute d;

  d := pg_get_functiondef('public.hq_get_company_brief_v2()'::regprocedure);
  d := replace(d, 'perform public.hq_run_operating_cycle();', 'perform public.hq_run_company_intelligence_v2();');
  execute d;
end $$;

do $$
begin
  if to_regprocedure('public.hq_get_company_brief_v2()') is not null then
    comment on function public.hq_get_company_brief_v2() is
      'Owner-gated HQ brief. Refreshes deterministic company intelligence without invoking retired legacy workforce execution.';
  end if;
end $$;
