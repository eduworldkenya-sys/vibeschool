#!/usr/bin/env python3
from pathlib import Path

page = Path('app/hq/content/chemistry-command/page.tsx').read_text()

required = [
    'AUTHORING:"AUTHOR_QUEUED"',
    'P2_REVIEW:"P2_QUEUED"',
    'P3_REVIEW:"P3_QUEUED"',
    'REPAIRING:"REPAIR_QUEUED"',
    'FRESH_P2_REVIEW:"FRESH_P2_QUEUED"',
    'FRESH_P3_REVIEW:"FRESH_P3_QUEUED"',
    'async function commission(item:Item)',
    'for(let step=0;step<8;step++)',
    'safeRuntime(fresh)',
    'Commission chapter',
    'Human release authority is still required.',
    'supabase.functions.invoke("chemistry-stage-executor"',
    'function stageExecution(item:Item,now:number)',
    'lease_expires_at',
    'kind:"working"',
    'kind:"stalled"',
    'Working · lease active',
    'Stalled · lease expired',
    'Retry chapter with Laban',
    'Retry preserves that attempt as TIMED_OUT',
    'Retry stays locked to prevent duplicate execution',
]
missing = [token for token in required if token not in page]
if missing:
    raise SystemExit('Chemistry commissioning contract missing: ' + ', '.join(missing))

for forbidden in [
    'runtime_execution_enabled:true',
    'shadow_scheduler_enabled:true',
    'shadow_global_stop:false',
    'publish_chapter',
    'approve_publication',
    'const claimable=!!queuedStageFor[i.stage]',
]:
    if forbidden in page:
        raise SystemExit('Chemistry commissioning safety boundary violated: ' + forbidden)

print('Chemistry one-click commissioning + stale-lease recovery contract: PASS')
