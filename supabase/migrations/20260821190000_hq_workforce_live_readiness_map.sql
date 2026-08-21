-- Founder-safe, read-only projection for the live Worker Engine readiness map.
-- Assurance tables remain service-only; this function exposes only operational labels.

create or replace function public.hq_workforce_get_live_readiness_map()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_result jsonb;
begin
  perform public.hq_assert_owner();

  select jsonb_build_object(
    'generated_at', clock_timestamp(),
    'workers', coalesce(jsonb_agg(jsonb_build_object(
      'worker_key', w.worker_key,
      'title', w.title,
      'department_key', w.department_key,
      'registry_status', w.status,
      'risk_class', a.risk_class,
      'qualification_state', coalesce(a.qualification_state, 'UNASSESSED'),
      'certification_state', coalesce(a.certification_state, 'SUSPENDED'),
      'legacy_recertification_required', coalesce(a.legacy_recertification_required, true),
      'certified_at', a.certified_at,
      'expires_at', a.expires_at
    ) order by w.department_key, w.worker_key), '[]'::jsonb)
  )
  into v_result
  from public.hq_workforce_workers w
  left join public.hq_workforce_worker_assurance a
    on a.worker_key = w.worker_key
   and a.standard_key = 'vibeschool-professional-worker'
   and a.standard_version = 1;

  return v_result;
end
$function$;

revoke all on function public.hq_workforce_get_live_readiness_map() from public, anon;
grant execute on function public.hq_workforce_get_live_readiness_map() to authenticated;

comment on function public.hq_workforce_get_live_readiness_map() is
  'Owner-only, read-only readiness projection for the HQ Worker Engine map.';
