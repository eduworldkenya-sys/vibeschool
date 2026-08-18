-- Task 8 — privileged Student Twin helper boundary.
-- These SECURITY DEFINER helpers are invoked by already-authorized higher-level
-- RPCs. They must not be directly callable with arbitrary learner identifiers.
revoke execute on function public.twin_record_learning_representation_exposure(uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.twin_record_verified_practice_effect(uuid, uuid, text, text, boolean, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.twin_resolve_learning_exposures(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.twin_resolve_learning_representation_outcome(uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.twin_record_verified_calibration(uuid, text, numeric, numeric, numeric, uuid, uuid, text, uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.twin_record_verified_calibration(uuid, text, numeric, numeric, numeric, uuid, uuid, text, uuid, jsonb)
  to service_role;
