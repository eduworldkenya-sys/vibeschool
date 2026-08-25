#!/usr/bin/env python3
from pathlib import Path

migration = Path('supabase/migrations/20260825055000_chemistry_fast_trust_runtime.sql').read_text()
executor = Path('supabase/functions/chemistry-stage-executor/index.ts').read_text()
doctrine = Path('docs/content/CHEMISTRY_FAST_TRUST_CONTRACT.json').read_text()

required_migration = [
    'create table public.chemistry_research_packs',
    'create table public.chemistry_coverage_snapshots',
    'chemistry_research_packs_append_only',
    'chemistry_coverage_snapshots_append_only',
    'chemistry_fast_trust_contract()',
    "'research_pack',case when pack.id is null then null else to_jsonb(pack) end",
    "'latest_review_receipt',case when prior_review.attempt_id is null then null else to_jsonb(prior_review) end",
    'chemistry_enforce_fast_trust_receipt',
    'CHEMISTRY_CRITIC_PASS_REQUIRES_ZERO_OMISSIONS',
    'CHEMISTRY_REPAIR_PASS_REQUIRES_RESOLVED_TARGETS_AND_COMPLETE_COVERAGE',
    'CHEMISTRY_FAST_TRUST_NON_ACTIVATING_BOUNDARY_VIOLATED',
]
required_executor = [
    'researchPackComplete',
    'coverageMatrix',
    'repairTargets',
    'omissionReview',
    'research_pack:packContent(packet)',
    'repair_targets:targets',
    'omission_search:{performed:true,missing_requirements:[],coverage_unknown:false}',
    'CHEMISTRY_RESEARCH_PACK_INCOMPLETE',
    'CHEMISTRY_REPAIR_TARGETS_REQUIRED',
    'chemistry_research_packs',
    'chemistry_coverage_snapshots',
    'fast_trust_contract_version:1',
    'research_pack_id:packId',
    'coverage_matrix:cov.matrix',
    'published:false',
    'side_effects_applied:false',
]
required_doctrine = [
    '"shared_across_workers": true',
    '"must_search_for_omissions": true',
    '"targeted_by_default": true',
    '"block_on_missing_mandatory": true',
]

for label, text, needles in [
    ('migration', migration, required_migration),
    ('executor', executor, required_executor),
    ('doctrine', doctrine, required_doctrine),
]:
    missing = [n for n in needles if n not in text]
    if missing:
        raise SystemExit(f'{label} missing fast-trust invariants: {missing}')

for candidate in (migration, executor):
    for forbidden in [
        'runtime_execution_enabled=true',
        'heartbeat_enabled=true',
        'factory_enabled=true',
        'shadow_enabled=true',
        'shadow_scheduler_enabled=true',
        'shadow_global_stop=false',
        'automatic_publishing=true',
        'published:true',
        'side_effects_applied:true',
    ]:
        if forbidden in candidate:
            raise SystemExit(f'forbidden activation/side-effect detected: {forbidden}')

if migration.find('perform public.chemistry_assert_cyborg_stage_lease') > migration.find('select * into a from public.chemistry_worker_stage_attempts where id=p_attempt_id;'):
    raise SystemExit('fast-trust execution packet must assert the lease before reading mission state')
if 'grant select, insert on public.chemistry_research_packs, public.chemistry_coverage_snapshots\n  to service_role;' not in migration:
    raise SystemExit('fast-trust evidence tables must be service-only')
if 'Explicitly search for required material that is absent' not in executor:
    raise SystemExit('Critic prompt must explicitly search for omissions')
if 'Never regenerate the whole chapter unless a repair target proves the structure unsalvageable' not in executor:
    raise SystemExit('Repair must remain targeted by default')

print('Chemistry fast-trust runtime validation: PASS')
