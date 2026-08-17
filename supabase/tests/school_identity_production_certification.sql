-- School Identity Engine production certification assertions.
-- Read-only: safe to run against a migrated database.
DO $cert$
DECLARE v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND p.proname = ANY (ARRAY[
      'hq_stage_school_directory_batch','hq_seal_authoritative_school_snapshot',
      'hq_reconcile_authoritative_school_snapshot','hq_ingest_live_authoritative_school_observation',
      'hq_promote_authoritative_school_record','hq_run_school_identity_matching',
      'hq_score_pending_school_identity_candidates','hq_build_identity_review_queue',
      'hq_list_school_identity_queue','hq_review_school_identity_candidate',
      'hq_resolve_school_identity_review','hq_resolve_school_discovery_request',
      'hq_school_identity_coverage_by_county'])
    AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'));
  IF v_bad <> 0 THEN RAISE EXCEPTION 'CERT_FAIL: privileged School Engine RPC exposed to anon/authenticated (% functions)',v_bad; END IF;

  SELECT count(*) INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='normalize_school_identity_name'
    AND NOT coalesce(p.proconfig,'{}'::text[]) @> ARRAY['search_path=pg_catalog'];
  IF v_bad <> 0 THEN RAISE EXCEPTION 'CERT_FAIL: normalize_school_identity_name search_path not fixed'; END IF;

  SELECT count(*) INTO v_bad FROM public.school_directory_source_observations o
  LEFT JOIN public.school_directory_ingest_batches b ON b.id=o.ingest_batch_id
  WHERE b.id IS NULL OR o.record_hash !~ '^[0-9a-f]{64}$';
  IF v_bad <> 0 THEN RAISE EXCEPTION 'CERT_FAIL: invalid authoritative observation provenance (% rows)',v_bad; END IF;

  SELECT count(*) INTO v_bad
  FROM public.school_directory_source_observations o
  JOIN public.school_directory_ingest_batches b ON b.id=o.ingest_batch_id
  JOIN public.school_directory_source_registry s ON s.source_name=o.source_name
  WHERE s.authority_tier=0 AND (b.authority_certified_at IS NULL OR nullif(trim(b.authority_basis),'') IS NULL);
  IF v_bad <> 0 THEN RAISE EXCEPTION 'CERT_FAIL: uncertified Tier-0 observations (% rows)',v_bad; END IF;

  SELECT count(*) INTO v_bad FROM public.school_authoritative_reconciliation
  WHERE promoted_at IS NOT NULL AND canonical_school_id IS NULL;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'CERT_FAIL: promoted reconciliation missing canonical target (% rows)',v_bad; END IF;

  SELECT count(*) INTO v_bad FROM (
    SELECT directory_school_id FROM public.school_identity_candidates
    WHERE directory_school_id IS NOT NULL AND status IN ('pending','matched','new')
    GROUP BY directory_school_id HAVING count(*)>1
  ) d;
  IF v_bad <> 0 THEN RAISE EXCEPTION 'CERT_FAIL: duplicate active identity candidates (% schools)',v_bad; END IF;
END
$cert$;
