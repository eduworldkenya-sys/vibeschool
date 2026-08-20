-- Production parity repair: the legacy R1.3X snapshot currently references a metrics
-- function that is absent from repository and production. Do not fabricate metrics.
-- Return an explicit uncertified state for that specific contract-missing condition.
create or replace function public.hq_workforce_get_r13x_certification_snapshot(
  p_since timestamptz default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.hq_assert_owner();
  begin
    return public.hq_workforce_r13x_certification_assessment(p_since);
  exception
    when undefined_function then
      return jsonb_build_object(
        'certified',false,
        'available',false,
        'repository_or_trial_blockers',jsonb_build_array('r13x_metrics_contract_missing'),
        'recommendation_sample_present',false,
        'metrics',null,
        'observed_at',clock_timestamp(),
        'note','R1.3X certification metrics contract is missing. Certification is fail-closed; no evidence was inferred or fabricated.'
      );
  end;
end $$;
revoke all on function public.hq_workforce_get_r13x_certification_snapshot(timestamptz) from public,anon,service_role;
grant execute on function public.hq_workforce_get_r13x_certification_snapshot(timestamptz) to authenticated;
comment on function public.hq_workforce_get_r13x_certification_snapshot(timestamptz) is
'Owner-only R1.3X certification snapshot. Fails closed as uncertified when its legacy metrics contract is unavailable.';
