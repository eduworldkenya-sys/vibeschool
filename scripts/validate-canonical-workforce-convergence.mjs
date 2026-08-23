#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function fail(code, detail) {
  failures.push({ code, detail })
}

function read(rel) {
  const full = path.join(root, rel)
  if (!fs.existsSync(full)) {
    fail('required_file_missing', rel)
    return ''
  }
  return fs.readFileSync(full, 'utf8')
}

function walk(dir, out = []) {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) return out
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(rel, out)
    else out.push(rel)
  }
  return out
}

// Canonical repository/database authority paths must remain present.
const requiredFiles = [
  'supabase/migrations/20260815123000_worker_engine_we_r1_4_consequential_execution_gateway.sql',
  'supabase/migrations/20260815123100_worker_engine_we_r1_4_gateway_evidence_binding_fix.sql',
  'supabase/migrations/20260815124000_worker_engine_we_r1_4_preconditions_idempotency.sql',
  'supabase/migrations/20260815132500_worker_engine_we_r1_4_budget_rate_concurrency.sql',
  'supabase/migrations/20260815133500_worker_engine_we_r1_4_circuit_breakers_stops.sql',
  'supabase/migrations/20260823080000_cyborg_hard_llm_enforcement.sql',
  'supabase/migrations/20260823080100_cyborg_request_hash_binding.sql',
  'supabase/functions/cyborg-admission/index.ts',
  'supabase/functions/cyborg-llm-gateway/index.ts',
  'supabase/functions/_shared/cyborg-capability.ts',
]
for (const file of requiredFiles) read(file)

// Reject the known parallel architecture proposed in the pasted package.
const allRepoFiles = [
  ...walk('lib'),
  ...walk('supabase'),
  ...walk('scripts'),
].filter((p) => /\.(ts|tsx|js|mjs|sql)$/.test(p))

const parallelPatterns = [
  ['parallel_admission_table', /hq_workforce_admission_tokens/],
  ['parallel_certification_ledger', /hq_workforce_certification_ledger/],
  ['parallel_runtime_entrypoint', /executeCanonicalWorker\s*\(/],
]

for (const rel of allRepoFiles) {
  if (rel === 'scripts/validate-canonical-workforce-convergence.mjs') continue
  const text = read(rel)
  for (const [code, pattern] of parallelPatterns) {
    if (pattern.test(text)) fail(code, rel)
  }
}

// Direct model-provider use is only allowed in explicit Cyborg/provider-boundary files.
const allowedProviderFiles = new Set([
  'supabase/functions/cyborg-llm-gateway/index.ts',
  'supabase/functions/_shared/cyborg-model-client.ts',
])
const providerPatterns = [
  /from\s+['"]groq-sdk['"]/,
  /from\s+['"]openai['"]/,
  /from\s+['"]@anthropic-ai\/sdk['"]/,
  /api\.openai\.com/,
  /api\.anthropic\.com/,
  /api\.groq\.com/,
]
for (const rel of [...walk('supabase/functions'), ...walk('lib')].filter((p) => /\.(ts|tsx|js|mjs)$/.test(p))) {
  if (allowedProviderFiles.has(rel)) continue
  const text = read(rel)
  if (providerPatterns.some((p) => p.test(text))) fail('direct_provider_bypass', rel)
}

// Cyborg capabilities must prove request binding and single-use/replay resistance.
const capability = read('supabase/functions/_shared/cyborg-capability.ts')
if (!/request[_A-Za-z]*hash|requestHash/i.test(capability)) {
  fail('cyborg_request_hash_binding_missing', 'supabase/functions/_shared/cyborg-capability.ts')
}
if (!/nonce|single[-_ ]?use|consum/i.test(capability)) {
  fail('cyborg_replay_protection_missing', 'supabase/functions/_shared/cyborg-capability.ts')
}

// Existing R1.4 execution gateway must retain evidence/idempotency/budget/stop dependencies.
const gateway = read('supabase/migrations/20260815123000_worker_engine_we_r1_4_consequential_execution_gateway.sql')
const evidenceBinding = read('supabase/migrations/20260815123100_worker_engine_we_r1_4_gateway_evidence_binding_fix.sql')
const idempotency = read('supabase/migrations/20260815124000_worker_engine_we_r1_4_preconditions_idempotency.sql')
const budget = read('supabase/migrations/20260815132500_worker_engine_we_r1_4_budget_rate_concurrency.sql')
const stops = read('supabase/migrations/20260815133500_worker_engine_we_r1_4_circuit_breakers_stops.sql')

if (!/evidence|verification/i.test(gateway + '\n' + evidenceBinding)) fail('evidence_binding_missing', 'R1.4 gateway')
if (!/idempoten|execution_intent|duplicate/i.test(idempotency)) fail('idempotency_control_missing', 'R1.4 preconditions')
if (!/budget|reserve|rate|concurr/i.test(budget)) fail('budget_control_missing', 'R1.4 budget controls')
if (!/global[_ ]stop|breaker|stop/i.test(stops)) fail('global_stop_or_breaker_missing', 'R1.4 stop controls')

// Certification/assurance separation must remain represented in schema migrations.
const certificationFiles = allRepoFiles.filter((p) => p.includes('migration') || p.includes('workforce')).slice(0)
let certificationCorpus = ''
for (const rel of certificationFiles) {
  const text = read(rel)
  if (/certif|assurance|verifier/i.test(text)) certificationCorpus += '\n' + text
}
if (!/self[_ -]?certif|independent[_ -]?(evaluator|verifier|assurance)|worker_key\s*<>|worker_key\s*!=/i.test(certificationCorpus)) {
  fail('independent_certification_separation_not_proven', 'repository certification corpus')
}

if (failures.length) {
  console.error('Canonical Workforce Convergence: FAILED')
  for (const f of failures) console.error(`- ${f.code}: ${f.detail}`)
  process.exit(1)
}

console.log('Canonical Workforce Convergence: PASS')
console.log(`Scanned ${allRepoFiles.length} repository authority/runtime files.`)
