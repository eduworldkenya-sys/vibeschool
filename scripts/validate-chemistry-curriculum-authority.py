#!/usr/bin/env python3
from pathlib import Path

migration = Path('supabase/migrations/20260825090000_chemistry_curriculum_authority_binding.sql').read_text()
reconciliation = Path('supabase/migrations/20260825114500_chemistry_curriculum_authority_reconciliation.sql').read_text()
hierarchy_uuid_repair = Path('supabase/migrations/20260825152500_fix_curriculum_authority_uuid_min.sql').read_text()
outcome_hierarchy_repair = Path('supabase/migrations/20260825155500_bind_verified_chemistry_outcomes_hierarchy.sql').read_text()

required = [
    'source_import_id uuid', 'content_sha256 text', 'source_locator text',
    'curriculum_verified_source_immutable', 'curriculum_verified_outcome_immutable',
    'hq_seal_curriculum_import_source', 'hq_bind_curriculum_outcomes_to_import',
    'hq_verify_curriculum_outcomes', 'OUTCOME_CODE_AND_EXACT_SOURCE_LOCATION_REQUIRED',
    'chemistry_curriculum_authority_snapshot', "'authority_lock_sha256',v_digest",
    'v_linked_chapters=v_chapters', 'v_mapped_outcomes=v_outcomes', 'v_invalid_links=0',
    'chemistry_require_curriculum_before_mission', 'chemistry_bind_curriculum_authority_to_attempt',
    "'curriculum_authority',v_snapshot", 'chemistry_require_curriculum_before_publication',
    'CHEMISTRY_CURRICULUM_AUTHORITY_INCOMPLETE',
    'CHEMISTRY_CURRICULUM_AUTHORITY_NON_ACTIVATING_BOUNDARY_VIOLATED',
    'CHEMISTRY_CURRICULUM_HUMAN_AUTHORITY_EXPOSED',
]
missing = [needle for needle in required if needle not in migration]
if missing:
    raise SystemExit(f'Chemistry curriculum authority invariants missing: {missing}')
for forbidden in ['runtime_execution_enabled=true','heartbeat_enabled=true','factory_enabled=true','shadow_enabled=true','shadow_scheduler_enabled=true','shadow_global_stop=false',"set status='verified' where", "set status='published'",'automatic_publishing=true']:
    if forbidden in migration:
        raise SystemExit(f'Forbidden activation or automatic authority detected: {forbidden}')
if migration.count('perform public.hq_assert_owner();') < 4:
    raise SystemExit('Every human curriculum mutation must remain owner-gated')
if "grant execute on function public.chemistry_curriculum_authority_snapshot(uuid,boolean) to service_role;" not in migration:
    raise SystemExit('Mission execution requires service-only curriculum snapshot access')
if "grant execute on function public.chemistry_curriculum_authority_snapshot(uuid,boolean) to authenticated" in migration:
    raise SystemExit('Raw authority snapshot must not become a client mutation surface')

reconciliation_required = ['curriculum_outcome_reconciliation_audit','hq_prepare_grade10_chemistry_authority','hq_verify_grade10_chemistry_authority','CHEMISTRY_OUTCOME_COHORT_DRIFT','EXACT_APPROVED_KICD_CHEMISTRY_ARTIFACT_REQUIRED',"'verified',false",'v_updated<>32','v_count<>32','grant execute on function public.hq_prepare_grade10_chemistry_authority(uuid,uuid)']
missing_reconciliation = [needle for needle in reconciliation_required if needle not in reconciliation]
if missing_reconciliation:
    raise SystemExit(f'Chemistry reconciliation invariants missing: {missing_reconciliation}')
if reconciliation.count("('CHEM-G10-") != 32:
    raise SystemExit('Exact KICD outcome ledger must contain 32 coded outcomes')
for forbidden in ['runtime_execution_enabled=true','heartbeat_enabled=true',"set status='published'",'automatic_publishing=true']:
    if forbidden in reconciliation:
        raise SystemExit(f'Forbidden activation detected in reconciliation: {forbidden}')
if reconciliation.count('perform public.hq_assert_owner();') != 2:
    raise SystemExit('Preparation and verification must both remain owner-gated')

hierarchy_repair_required = ['curriculum_authority_bind_hierarchy','(array_agg(cs.id order by cs.id))[1]','ambiguous_unpaced_cbc_hierarchy',"'pacing_authority',false",'perform public.hq_assert_owner();','grant execute on function public.curriculum_authority_bind_hierarchy(uuid) to authenticated']
missing_hierarchy_repair = [needle for needle in hierarchy_repair_required if needle not in hierarchy_uuid_repair]
if missing_hierarchy_repair:
    raise SystemExit(f'Hierarchy UUID repair invariants missing: {missing_hierarchy_repair}')
if 'min(cs.id)' in hierarchy_uuid_repair:
    raise SystemExit('Hierarchy binding must not call unsupported min(uuid)')
for forbidden in ['runtime_execution_enabled=true','heartbeat_enabled=true',"set status='published'",'automatic_publishing=true']:
    if forbidden in hierarchy_uuid_repair:
        raise SystemExit(f'Forbidden activation detected in hierarchy repair: {forbidden}')

outcome_hierarchy_required = ['hq_bind_verified_grade10_chemistry_outcomes_hierarchy','VERIFIED_GRADE10_CHEMISTRY_IMPORT_REQUIRED','RECONCILED_32_OBSERVATION_SNAPSHOT_REQUIRED','EXACT_SEVEN_HIERARCHY_BINDINGS_REQUIRED','EXPECTED_32_MISSING_OUTCOMES_REQUIRED','OUTCOME_HIERARCHY_PROVENANCE_INCOMPLETE','VERIFIED_OUTCOME_COHORT_DRIFT','CHEMISTRY_HIERARCHY_BINDING_INCOMPLETE',"set status='sealed',reconciled_at=null", "'requires_fresh_reconciliation',true",'perform public.hq_assert_owner();','grant execute on function public.hq_bind_verified_grade10_chemistry_outcomes_hierarchy(uuid,uuid)']
missing_outcome_hierarchy = [needle for needle in outcome_hierarchy_required if needle not in outcome_hierarchy_repair]
if missing_outcome_hierarchy:
    raise SystemExit(f'Outcome hierarchy binding invariants missing: {missing_outcome_hierarchy}')
for forbidden in ['runtime_execution_enabled=true','heartbeat_enabled=true',"set status='published'",'automatic_publishing=true',"set status='verified'"]:
    if forbidden in outcome_hierarchy_repair:
        raise SystemExit(f'Forbidden activation detected in outcome hierarchy repair: {forbidden}')
if outcome_hierarchy_repair.count('perform public.hq_assert_owner();') != 1:
    raise SystemExit('Outcome hierarchy repair must remain a single explicit owner-gated mutation')

print('Chemistry canonical curriculum authority validation: PASS')
