import fs from 'node:fs'

const read = (p) => fs.readFileSync(p, 'utf8')
const fail = (m) => { throw new Error(`TASK11_RELIABILITY_CONTRACT: ${m}`) }
const must = (text, needle, m) => { if (!text.includes(needle)) fail(m) }
const mustNot = (text, needle, m) => { if (text.includes(needle)) fail(m) }

const commerce = read('supabase/migrations/20260818043000_learning_product_commerce_spine_v1.sql')
const retryGuard = read('supabase/migrations/20260818043400_learning_product_order_retry_and_duplicate_guard_v1.sql')
const callback = read('supabase/functions/learning-product-mpesa-callback/index.ts')
const legacyCallback = read('supabase/functions/mpesa-callback/index.ts')
const hqHardening = read('supabase/migrations/20260809093000_hq_operational_hardening_10of10.sql')
const hqSignals = read('supabase/migrations/20260818235500_hq_signal_center_r3_founder_ops.sql')
const telemetry = read('supabase/migrations/20260819183000_task12_pilot_observability_reconcile.sql')
const cycleRepair = read('supabase/migrations/20260820041500_task11_hq_operating_cycle_reliability_repair.sql')
const sw = read('public/sw.js')

// Money: retry, duplicate and uncertain-state safety.
must(commerce, 'unique (purchaser_profile_id, idempotency_key)', 'orders need durable idempotency uniqueness')
must(commerce, 'unique (payer_profile_id, idempotency_key)', 'payment attempts need durable idempotency uniqueness')
must(commerce, 'unique (checkout_request_id)', 'provider checkout ids must be unique')
must(commerce, 'unique (provider_receipt)', 'provider receipts must be unique')
must(commerce, "'reconciliation_required'", 'uncertain payment state must be first class')
must(retryGuard, 'pg_advisory_xact_lock', 'concurrent purchase decisions must serialize')
must(retryGuard, "'payment_reconciliation_required'", 'uncertain provider state must block a second charge')
must(retryGuard, "'existing_order'", 'response-loss retry must recover the canonical pending order')

// Callback: evidence before acknowledgement, duplicate recovery, no retry storm after durable persistence.
for (const [name, source, table] of [
  ['learning product', callback, 'commerce_payment_callback_events'],
  ['legacy credits', legacyCallback, 'mpesa_callback_events'],
]) {
  must(source, `.from(\"${table}\")`, `${name} callback must persist durable evidence`)
  must(source, '23505', `${name} callback must recover duplicate delivery`)
  must(source, 'processing_status !== \"processed\"', `${name} callback replay must avoid reprocessing completed events`)
  must(source, 'Accepted for reconciliation', `${name} callback must preserve uncertain post-persistence state`)
  const persist = source.indexOf(`.from(\"${table}\")`)
  const accepted = source.lastIndexOf('ResultCode: 0')
  if (persist < 0 || accepted < 0 || persist > accepted) fail(`${name} callback acknowledges before persistence boundary`)
}

// Incident truth: dedupe and verified recovery before resolution.
must(hqHardening, 'hq_incidents_fingerprint_idx', 'incident fingerprinting must remain present')
must(hqHardening, "status<>'resolved'", 'open-incident dedupe must not create storms')
must(hqHardening, 'hq_system_health()', 'operator health evidence must remain inspectable')

// HQ cycle: retired Worker execution must not poison reliability/cron work.
must(cycleRepair, "'workerExecution', 'governed_separately_by_we_r1_4'", 'HQ cycle must explicitly separate Worker execution authority')
must(cycleRepair, "command := 'select public.hq_run_company_intelligence_v2();'", 'company-intelligence cron must bypass retired Worker executor')
mustNot(cycleRepair, 'hq_workforce_execute_safe_queue()', 'Task 11 repair must not invoke retired Worker executor')
must(cycleRepair, "raise exception 'TASK11: company-intelligence cron exists but canonical intelligence function is missing'", 'cron repair must fail closed on impossible production state')

// Notification delivery: queued != delivered and external delivery is deduplicated.
must(hqSignals, "status text not null default 'queued' check (status in ('queued','sent','failed','cancelled'))", 'delivery state must distinguish queued/sent/failed')
must(hqSignals, 'unique(dedupe_key)', 'external notification delivery needs dedupe')
must(hqSignals, 'Queued does not mean delivered', 'fake-success boundary must remain explicit')

// Task 12 handoff: failure/unknown/network semantics remain explicit.
must(telemetry, "'unknown'", 'unknown failure/network states must remain representable')
must(telemetry, "'timeout'", 'timeout must remain a first-class network state')
must(telemetry, "outcome in ('failed','denied')", 'failure telemetry must preserve denied/failed distinction')
must(telemetry, 'idempotency_key', 'telemetry retries need idempotency support')

// PWA: authenticated/private state must never be served as cached authority.
must(sw, "url.pathname.startsWith('/auth/')", 'auth routes must bypass service-worker caching')
must(sw, "url.pathname.startsWith('/api/')", 'API routes must bypass service-worker caching')
must(sw, 'SAFE_PUBLIC_PATHS.has(url.pathname)', 'only explicit public navigations may use route cache')
mustNot(sw, "'/teacher'", 'teacher workspace must not be in safe public cache')
mustNot(sw, "'/student'", 'student workspace must not be in safe public cache')
mustNot(sw, "'/parent'", 'parent workspace must not be in safe public cache')
mustNot(sw, "'/admin'", 'admin workspace must not be in safe public cache')
mustNot(sw, "'/hq'", 'HQ workspace must not be in safe public cache')

console.log('TASK11_RELIABILITY_CONTRACT PASS')
