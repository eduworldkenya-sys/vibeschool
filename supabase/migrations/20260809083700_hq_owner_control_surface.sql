-- HQ owner command-center control surface.
-- Production was applied first during certification; this file preserves repository parity.

create or replace function public.hq_get_product_controls()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.hq_assert_owner();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_key', s.product_key,
      'policy_key', s.policy_key,
      'desired_value', s.desired_value,
      'received_value', s.received_value,
      'observed_value', s.observed_value,
      'state', s.state,
      'verified_at', s.verified_at,
      'last_error', s.last_error
    ) order by s.product_key, s.policy_key)
    from public.hq_product_policy_state s
    where s.policy_key in (
      'student.enabled','teacher.enabled','parent.enabled','school_admin.enabled',
      'vibelearn.enabled','vibebooks.enabled','vibelabs.enabled','billing.enabled',
      'twin.enabled','assessment.release_enabled','publication.release_enabled'
    )
  ), '[]'::jsonb);
end $$;

revoke all on function public.hq_get_product_controls() from public, anon;
grant execute on function public.hq_get_product_controls() to authenticated;

create or replace function public.hq_set_product_policy(
  p_product_key text,
  p_policy_key text,
  p_value jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_before jsonb;
begin
  perform public.hq_assert_owner();
  if nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'Reason is required';
  end if;
  perform public.hq_validate_policy_value(p_policy_key,p_product_key,p_value);
  v_before := public.hq_effective_policy_value(p_product_key,p_policy_key);
  v_id := public.hq_create_decision(
    'Set '||p_product_key||' · '||p_policy_key,
    'operations',
    'policy',
    p_policy_key,
    p_value,
    p_reason,
    array[p_product_key],
    now()
  );
  perform public.hq_approve_decision(v_id);
  perform public.hq_lock_decision(v_id);
  return jsonb_build_object(
    'decision_id',v_id,
    'product_key',p_product_key,
    'policy_key',p_policy_key,
    'previous_value',v_before,
    'new_value',p_value,
    'state','published'
  );
end $$;

revoke all on function public.hq_set_product_policy(text,text,jsonb,text) from public, anon;
grant execute on function public.hq_set_product_policy(text,text,jsonb,text) to authenticated;
