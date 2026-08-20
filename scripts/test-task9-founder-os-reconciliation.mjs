import fs from 'node:fs'

const migration = fs.readFileSync('supabase/migrations/20260820071000_task9_founder_os_reconciliation.sql','utf8')
const operations = fs.readFileSync('app/hq/operations/page.tsx','utf8')
const shell = fs.readFileSync('components/hq/HQShell.tsx','utf8')

for (const token of [
  'hq_founder_os_snapshot_core',
  'hq_founder_os_snapshot',
  'hq_revenue_operations_snapshot',
  'hq_workforce_get_r13x_certification_snapshot',
  'r13x_metrics_contract_missing',
  'business_integrity',
  'payment_exceptions',
  'content_health_critical',
  'mpesa_initiation_enabled',
  'hq_workforce_runtime_readiness',
  'hq_assert_owner',
  'security definer',
  'set search_path=public,pg_temp',
  'revoke all',
  'grant execute',
  "'INCIDENT'",
  "'DEGRADED'",
  "'ATTENTION'",
  "'LIVE'",
  'hq_workforce_execution_intents',
  'hq_workforce_execution_verifications',
  'hq_workforce_task_verifications',
  'hq_workforce_execution_breakers',
  'execution_intent_id',
  'coalesce(r.task_id,r.work_item_id)',
  'Historical runs exist without a complete intent-to-verification trail',
  'can_request_activation',
  'blocked_reasons',
  'active_capability_grants',
]) {
  if (!migration.includes(token)) throw new Error(`Task 9 migration missing ${token}`)
}

if (/insert\s+into|update\s+public\.|delete\s+from/i.test(migration)) {
  throw new Error('Task 9 Founder OS reconciliation must remain observation-only')
}
if (/runtime_execution_enabled\s*=\s*true|shadow_global_stop\s*=\s*false|runtime_autonomy_level\s*=\s*[1-9]/i.test(migration)) {
  throw new Error('Task 9 must not contain a Worker activation path')
}

for (const token of [
  'hq_founder_os_snapshot',
  'hq_workforce_runtime_readiness',
  'Business integrity',
  'Payment exceptions',
  'M-Pesa initiation',
  'R1.3X evidence',
  'Attention Required',
  'Execution integrity',
  'Verification deficit',
  'Global Stop',
  'Activation readiness',
  'ACTIVATION BLOCKED',
  'Recent execution lineage',
  '/hq/workforce',
]) {
  if (!operations.toLowerCase().includes(token.toLowerCase())) throw new Error(`Founder Operations UI missing ${token}`)
}

for (const forbidden of [
  'hq_workforce_owner_set_runtime',
  'hq_workforce_owner_start',
  'hq_workforce_owner_release_global_stop',
  'publish_publication',
]) {
  if (operations.includes(forbidden)) throw new Error(`Founder Operations UI contains forbidden mutation path: ${forbidden}`)
}

if (!shell.includes('["Operations","/hq/operations","◈"]')) {
  throw new Error('HQ shell must route canonical Operations navigation to /hq/operations')
}

console.log('Task 9 Founder OS reconciliation contract: PASS')
