#!/usr/bin/env python3
from pathlib import Path

migration = Path('supabase/migrations/20260825090000_chemistry_curriculum_authority_binding.sql').read_text()

required = [
    'source_import_id uuid',
    'content_sha256 text',
    'source_locator text',
    'curriculum_verified_source_immutable',
    'curriculum_verified_outcome_immutable',
    'hq_seal_curriculum_import_source',
    'hq_bind_curriculum_outcomes_to_import',
    'hq_verify_curriculum_outcomes',
    'OUTCOME_CODE_AND_EXACT_SOURCE_LOCATION_REQUIRED',
    'chemistry_curriculum_authority_snapshot',
    "'authority_lock_sha256',v_digest",
    "v_linked_chapters=v_chapters",
    "v_mapped_outcomes=v_outcomes",
    "v_invalid_links=0",
    'chemistry_require_curriculum_before_mission',
    'chemistry_bind_curriculum_authority_to_attempt',
    "'curriculum_authority',v_snapshot",
    'chemistry_require_curriculum_before_publication',
    'CHEMISTRY_CURRICULUM_AUTHORITY_INCOMPLETE',
    'CHEMISTRY_CURRICULUM_AUTHORITY_NON_ACTIVATING_BOUNDARY_VIOLATED',
    'CHEMISTRY_CURRICULUM_HUMAN_AUTHORITY_EXPOSED',
]

missing = [needle for needle in required if needle not in migration]
if missing:
    raise SystemExit(f'Chemistry curriculum authority invariants missing: {missing}')

for forbidden in [
    'runtime_execution_enabled=true', 'heartbeat_enabled=true', 'factory_enabled=true',
    'shadow_enabled=true', 'shadow_scheduler_enabled=true', 'shadow_global_stop=false',
    "set status='verified' where", "set status='published'", 'automatic_publishing=true',
]:
    if forbidden in migration:
        raise SystemExit(f'Forbidden activation or automatic authority detected: {forbidden}')

if migration.count('perform public.hq_assert_owner();') < 4:
    raise SystemExit('Every human curriculum mutation must remain owner-gated')
if "grant execute on function public.chemistry_curriculum_authority_snapshot(uuid,boolean) to service_role;" not in migration:
    raise SystemExit('Mission execution requires service-only curriculum snapshot access')
if "grant execute on function public.chemistry_curriculum_authority_snapshot(uuid,boolean) to authenticated" in migration:
    raise SystemExit('Raw authority snapshot must not become a client mutation surface')

print('Chemistry canonical curriculum authority validation: PASS')
