-- School Engine certification contract.
-- This migration does not populate or promote schools. It adds an auditable,
-- read-only certification RPC for the owner control plane and deliberately
-- preserves fail-closed mutation privileges on ingestion/reconciliation RPCs.

create or replace function public.hq_school_engine_certification_status()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tier0_sources bigint;
  v_tier0_observations bigint;
  v_reconciled bigint;
  v_review bigint;
  v_engine_runs bigint;
  v_coverage_runs bigint;
  v_directory bigint;
  v_candidates bigint;
  v_canonical bigint;
  v_stage_authenticated boolean;
  v_seal_authenticated boolean;
  v_reconcile_authenticated boolean;
  v_live_authenticated boolean;
  v_normalize_search_path text;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(), false) then
    raise exception 'owner_authorization_required';
  end if;

  select count(*) into v_tier0_sources
  from public.school_directory_source_registry
  where authority_tier = 0 and canonical_use = true and active = true
    and verification_mode = 'authoritative';

  select count(*) into v_tier0_observations from public.school_directory_source_observations;
  select count(*) into v_reconciled from public.school_authoritative_reconciliation;
  select count(*) into v_review from public.school_identity_review_queue;
  select count(*) into v_engine_runs from public.school_identity_engine_runs;
  select count(*) into v_coverage_runs from public.school_identity_coverage_runs;
  select count(*) into v_directory from public.schools_directory;
  select count(*) into v_candidates from public.school_identity_candidates;
  select count(*) into v_canonical from public.schools where deleted_at is null;

  select has_function_privilege('authenticated', 'public.hq_stage_school_directory_batch(text,text,text,text,jsonb)', 'EXECUTE')
    into v_stage_authenticated;
  select has_function_privilege('authenticated', 'public.hq_seal_authoritative_school_snapshot(uuid,text)', 'EXECUTE')
    into v_seal_authenticated;
  select has_function_privilege('authenticated', 'public.hq_reconcile_authoritative_school_snapshot(uuid)', 'EXECUTE')
    into v_reconcile_authenticated;
  select has_function_privilege('authenticated', 'public.hq_ingest_live_authoritative_school_observation(text,text,timestamptz,jsonb)', 'EXECUTE')
    into v_live_authenticated;

  select array_to_string(p.proconfig, ',')
    into v_normalize_search_path
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'normalize_school_identity_name'
  order by p.oid
  limit 1;

  return jsonb_build_object(
    'contract_version', 'school-engine-cert-v1',
    'authority', jsonb_build_object(
      'tier0_sources', v_tier0_sources,
      'mutating_rpc_authenticated_execute', jsonb_build_object(
        'stage', v_stage_authenticated,
        'seal', v_seal_authenticated,
        'reconcile', v_reconcile_authenticated,
        'live_ingest', v_live_authenticated
      ),
      'fail_closed', not coalesce(v_stage_authenticated,false)
        and not coalesce(v_seal_authenticated,false)
        and not coalesce(v_reconcile_authenticated,false)
        and not coalesce(v_live_authenticated,false),
      'normalize_school_identity_name_search_path', v_normalize_search_path
    ),
    'population', jsonb_build_object(
      'tier0_observations', v_tier0_observations,
      'reconciled', v_reconciled,
      'review_queue', v_review,
      'engine_runs', v_engine_runs,
      'coverage_runs', v_coverage_runs,
      'directory_records', v_directory,
      'identity_candidates', v_candidates,
      'canonical_schools', v_canonical
    ),
    'gates', jsonb_build_object(
      'authority_hardened', not coalesce(v_stage_authenticated,false)
        and not coalesce(v_seal_authenticated,false)
        and not coalesce(v_reconcile_authenticated,false)
        and not coalesce(v_live_authenticated,false),
      'tier0_foundation_present', v_tier0_sources > 0,
      'tier0_population_started', v_tier0_observations > 1,
      'national_reconciliation_started', v_engine_runs > 0 or v_reconciled > 1,
      'national_coverage_proven', v_coverage_runs > 2,
      'final_certification_ready', v_tier0_observations > 1
        and (v_engine_runs > 0 or v_reconciled > 1)
        and v_coverage_runs > 2
    )
  );
end;
$$;

revoke all on function public.hq_school_engine_certification_status() from public, anon;
grant execute on function public.hq_school_engine_certification_status() to authenticated;

comment on function public.hq_school_engine_certification_status() is
  'Owner-only, read-only School Engine certification snapshot. Mutation RPCs remain fail-closed; population/promotion are separate controlled operations.';
