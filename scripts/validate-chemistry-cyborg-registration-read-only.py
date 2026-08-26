from pathlib import Path

migration = Path('supabase/migrations/20260826112000_chemistry_cyborg_registration_read_only_attempt.sql').read_text()
required = [
    "v_old text := E'where id=p_source_authority_ref::uuid\\n      for update;'",
    "v_new text := E'where id=p_source_authority_ref::uuid;'",
    "CHEMISTRY_CYBORG_REGISTER_CAPABILITY_LOCK_CONTRACT_DRIFT",
    "revoke insert,update,delete,truncate,references,trigger",
    "grant select on public.chemistry_worker_stage_attempts to service_role",
]
missing = [needle for needle in required if needle not in migration]
if missing:
    raise SystemExit(f'Chemistry read-only Cyborg registration invariants missing: {missing}')
if 'grant update on public.chemistry_worker_stage_attempts' in migration.lower():
    raise SystemExit('Chemistry capability registration must not gain stage-attempt mutation authority')
print('Chemistry Cyborg registration remains read-only: PASS')
