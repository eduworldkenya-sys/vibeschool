-- Quality evidence integrity: examination and fixture evidence are function-derived only.
-- access: service-read public.hq_workforce_quality_examinations; writes only through governed SECURITY DEFINER examiner.
-- authorization-test: service_role direct insert into public.hq_workforce_quality_examinations denied; hq_workforce_quality_examine_worker remains executable.
-- access: service-read public.hq_workforce_quality_fixture_results; writes only through governed SECURITY DEFINER fixture evaluator.
-- authorization-test: service_role direct insert into public.hq_workforce_quality_fixture_results denied; hq_workforce_quality_execute_lab_fixture remains executable.

revoke insert on table public.hq_workforce_quality_examinations from service_role;
revoke insert on table public.hq_workforce_quality_fixture_results from service_role;
grant select on table public.hq_workforce_quality_examinations to service_role;
grant select on table public.hq_workforce_quality_fixture_results to service_role;

-- Findings remain writable because recording a finding is a Quality Worker duty, but examination
-- and laboratory verdict rows are evidence outputs and cannot be supplied directly by callers.

grant execute on function public.hq_workforce_quality_examine_worker(text,text) to service_role;
grant execute on function public.hq_workforce_quality_execute_lab_fixture(text,text[],jsonb,text) to service_role;

-- Keep public/anon/authenticated completely denied.
revoke all on table public.hq_workforce_quality_examinations from public,anon,authenticated;
revoke all on table public.hq_workforce_quality_fixture_results from public,anon,authenticated;
