#!/usr/bin/env python3
from pathlib import Path

migration = Path('supabase/migrations/20260823210000_chemistry_cyborg_stage_execution_bridge.sql').read_text()
policy = Path('supabase/functions/_shared/cyborg-caller-policy.ts').read_text()
admission = Path('supabase/functions/cyborg-admission/index.ts').read_text()
executor = Path('supabase/functions/chemistry-stage-executor/index.ts').read_text()

required_migration = [
    'create table public.chemistry_stage_execution_receipts',
    'create table public.chemistry_worker_artifacts',
    'chemistry_stage_execution_receipts_append_only',
    'chemistry_worker_artifacts_append_only',
    "when 'edge.chemistry-stage-executor' then a.worker_key",
    'chemistry_get_stage_execution_packet',
    'CHEMISTRY_CYBORG_FAIL_CLOSED_POSTURE_REQUIRED',
    'runtime_execution_enabled,false',
    'heartbeat_enabled,false',
    'factory_enabled,false',
    'runtime_autonomy_level,0)<>0',
    'runtime_max_risk,0)<>0',
    'shadow_enabled,false',
    'shadow_scheduler_enabled,false',
    'shadow_global_stop,true',
    'grant select,insert on public.chemistry_stage_execution_receipts,public.chemistry_worker_artifacts',
]
required_policy = ["'edge.chemistry-stage-executor':{provider:'groq',models:['openai/gpt-oss-120b'],maxTokens:6000}"]
required_admission = [
    "'edge.chemistry-stage-executor'",
    "await rpc('chemistry_assert_cyborg_stage_lease'",
    "sourceAuthorityKind='chemistry_stage_attempt'",
    'authorityScope:[]',
    'toolScope:[]',
]
required_executor = [
    'hq_laban_claim_chemistry_stage',
    'p_lease_seconds:300',
    'chemistry_get_stage_execution_packet',
    'invokeCyborgEdgeModel',
    'callerServiceId:CALLER',
    'stageLease:{attemptId:claim.attempt_id,leaseToken:claim.lease_token}',
    'sourceAuthority:{kind:"chemistry_stage_attempt"',
    'chemistry_worker_artifacts',
    'chemistry_stage_execution_receipts',
    'chemistry_complete_stage',
    'learning_quality_contract_version:3',
    'side_effects_applied:false',
    'published:false',
    'replayed:true',
    'CHEMISTRY_AUTHOR_QUALITY_CONTRACT_FAILED',
    'CHEMISTRY_REPAIR_REGRESSION_CONTRACT_FAILED',
]

for label, text, needles in [
    ('migration', migration, required_migration),
    ('caller policy', policy, required_policy),
    ('admission', admission, required_admission),
    ('executor', executor, required_executor),
]:
    missing = [needle for needle in needles if needle not in text]
    if missing:
        raise SystemExit(f'{label} missing Chemistry Cyborg execution invariants: {missing}')

for candidate in (migration, executor):
    for forbidden in [
        'runtime_execution_enabled=true',
        'heartbeat_enabled=true',
        'factory_enabled=true',
        'shadow_enabled=true',
        'shadow_scheduler_enabled=true',
        'shadow_global_stop=false',
        'publication_allowed=true',
        'published:true',
        'side_effects_applied:true',
    ]:
        if forbidden in candidate:
            raise SystemExit(f'forbidden activation/side-effect detected: {forbidden}')

if 'hq_content_authoring_claim' in executor or 'content_worker_begin_execution' in executor:
    raise SystemExit('Chemistry executor must not route through the general runtime-dependent Author claim')
if "from public,anon,authenticated,service_role;\ngrant execute on function public.chemistry_get_stage_execution_packet" not in migration:
    raise SystemExit('execution packet must be service-only')
if migration.find('perform public.chemistry_assert_cyborg_stage_lease') > migration.find("select * into a from public.chemistry_worker_stage_attempts where id=p_attempt_id;"):
    raise SystemExit('execution packet must assert the lease before reading the stage packet')

print('Chemistry lease-bound Cyborg stage executor validation: PASS')
