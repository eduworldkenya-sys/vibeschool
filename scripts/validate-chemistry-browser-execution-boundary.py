from pathlib import Path

executor = Path('supabase/functions/chemistry-stage-executor/index.ts').read_text()
migration = Path('supabase/migrations/20260824225000_chemistry_laban_binding_idempotent_running.sql').read_text()

required_executor = [
    'access-control-allow-origin',
    'access-control-allow-headers',
    'access-control-allow-methods',
    'if(req.method==="OPTIONS")return new Response("ok",{status:200,headers:CORS})',
    'if(req.method!=="POST")return reply({error:"method_not_allowed"},405)',
    'authenticated_owner_required',
    'hq_laban_claim_chemistry_stage',
    'chemistry_complete_stage',
]
for token in required_executor:
    assert token in executor, f'missing executor browser-boundary invariant: {token}'

# Preflight must be handled before auth and method rejection.
assert executor.index('req.method==="OPTIONS"') < executor.index('req.method!=="POST"')
assert executor.index('req.method==="OPTIONS"') < executor.index('authenticated_owner_required')

required_migration = [
    'perform public.hq_assert_owner()',
    'select command_mission_id into existing_id',
    "if existing_id is not null then",
    "if cm.state <> 'READY' then raise exception 'CHEMISTRY_MISSION_NOT_READY:%',cm.state; end if;",
    "if cm.mode <> 'shadow' then raise exception 'CHEMISTRY_MISSION_SHADOW_REQUIRED'; end if;",
]
for token in required_migration:
    assert token in migration, f'missing binding idempotency invariant: {token}'

# Existing durable binding must be checked before the READY-only new-binding gate.
assert migration.index('if existing_id is not null then') < migration.index("if cm.state <> 'READY'")

# No safety relaxation: new binding still requires safe posture and Laban availability.
for token in [
    'LABAN_CHEMISTRY_BINDING_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON',
    'LABAN_COMMANDER_NOT_AVAILABLE',
    "'publication_authority',false",
    "'payment_authority',false",
    "'runtime_activation_authority',false",
    "'scheduler_authority',false",
    "'global_stop_must_remain_on',true",
]:
    assert token in migration, f'missing preserved safety invariant: {token}'

print('Chemistry browser execution + RUNNING binding contract: PASS')
