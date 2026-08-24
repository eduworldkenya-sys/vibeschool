#!/usr/bin/env python3
from pathlib import Path

migration = Path('supabase/migrations/20260824233000_chemistry_infrastructure_recovery_generation.sql').read_text()
executor = Path('supabase/functions/chemistry-stage-executor/index.ts').read_text()

required_migration = [
    'add column recovery_generation integer not null default 0',
    'drop constraint chemistry_worker_stage_attemp_item_id_stage_iteration_attem_key',
    'unique(item_id,stage,iteration,recovery_generation,attempt)',
    'and x.recovery_generation=i.recovery_generation',
    'and recovery_generation=i.recovery_generation',
    "create or replace function public.chemistry_recover_infrastructure_failure",
    "i.stage<>'ESCALATED'",
    "a.error_code<>'CHEMISTRY_STAGE_EXECUTOR_ERROR'",
    "not like 'CYBORG_ADMISSION_FAILED:%'",
    "not like 'CYBORG_GATEWAY_FAILED:%'",
    "not like 'CYBORG_PROVIDER_CREDENTIAL_REQUIRED:%'",
    'CHEMISTRY_RECOVERY_RECEIPT_ALREADY_EXISTS',
    "grant execute on function public.chemistry_claim_stage(uuid,text,text,integer),public.chemistry_recover_infrastructure_failure(uuid,text) to service_role",
]
required_executor = [
    'CYBORG_SIGNING_KEY.length<32',
    'CYBORG_CAPABILITY_SIGNING_KEY_REQUIRED',
    '!GROQ_KEY',
    'CYBORG_PROVIDER_CREDENTIAL_REQUIRED:groq',
    'claim_created:false',
]

for label, text, needles in [('migration', migration, required_migration), ('executor', executor, required_executor)]:
    missing = [needle for needle in needles if needle not in text]
    if missing:
        raise SystemExit(f'{label} missing infrastructure recovery invariants: {missing}')

preflight = executor.index('if(CYBORG_SIGNING_KEY.length<32)')
claim = executor.index('owner.rpc("hq_laban_claim_chemistry_stage"')
if preflight > claim:
    raise SystemExit('Cyborg configuration preflight must run before a Chemistry claim')

for forbidden in [
    'delete from public.chemistry_worker_stage_attempts',
    'runtime_execution_enabled=true',
    'shadow_enabled=true',
    'shadow_global_stop=false',
    'published:true',
    'side_effects_applied:true',
]:
    if forbidden in migration or forbidden in executor:
        raise SystemExit(f'forbidden recovery shortcut detected: {forbidden}')

print('Chemistry infrastructure preflight and bounded recovery validation: PASS')
