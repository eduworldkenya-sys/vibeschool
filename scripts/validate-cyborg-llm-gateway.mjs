import fs from 'node:fs';
import path from 'node:path';

const gateway = fs.readFileSync('lib/cyborg/gateway.ts', 'utf8');
for (const invariant of ['runCyborgMission','NO_DIRECT_LLM_CALLS','PREMATURE_MISSION_RETURN','CYBORG_MISSION_REQUIRED','CyborgUniversalGateway','invokeCyborgModel']) {
  if (!gateway.includes(invariant)) throw new Error(`CYBORG_GATEWAY_INVARIANT_MISSING:${invariant}`);
}

const economics = fs.readFileSync('lib/cyborg/economics.ts', 'utf8');
for (const invariant of [
  'BLOCKED_ECONOMIC',
  'CyborgEconomicLedger',
  'CyborgExactResponseCache',
  'CYBORG_ASSURANCE_BYPASS_DENIED',
  'CYBORG_DETERMINISTIC_RESULT_NOT_AUTHORIZED',
  'certification',
  'adversarial_review',
  'security_review',
  'CYBORG_CACHE_SCOPE_SHA_REQUIRED',
]) {
  if (!economics.includes(invariant)) throw new Error(`CYBORG_ECONOMIC_INVARIANT_MISSING:${invariant}`);
}
for (const invariant of [
  'getMissionEconomics',
  'deterministicResult',
  'exactCacheKey',
  'cacheScopeSha',
  'economicBudget',
  'estimateInputTokens',
  'normalizeUsage',
  'recommendedModelTier',
]) {
  if (!gateway.includes(invariant)) throw new Error(`CYBORG_GATEWAY_ECONOMIC_WIRING_MISSING:${invariant}`);
}

// Scan server-side/runtime authority surfaces. Legacy browser-only inference is not
// treated as an execution authority and is migrated independently.
const roots = ['app/api','lib','components','scripts','supabase/functions'];
const forbidden = [
  /new\s+OpenAI\s*\(/,
  /new\s+Anthropic\s*\(/,
  /new\s+GoogleGenerativeAI\s*\(/,
  /openai\.responses\.create\s*\(/,
  /anthropic\.messages\.create\s*\(/,
  /api\.anthropic\.com\/v1\/messages/,
  /api\.openai\.com\/v1\//,
  /generativelanguage\.googleapis\.com\//,
  /api\.groq\.com\/openai\/v1\//,
  /\bGROQ_API_KEY\b/,
  /\bANTHROPIC_API_KEY\b/,
  /\bOPENAI_API_KEY\b/,
];
const allow = new Set([
  'lib/cyborg/gateway.ts',
  'scripts/validate-cyborg-llm-gateway.mjs',
  'supabase/functions/cyborg-llm-gateway/index.ts',
]);
// Existing direct Edge integrations are frozen debt. This explicit list prevents
// additions while each entry is migrated through the canonical gateway.
const legacyEdgeProviderDebt = new Set([
  'app/api/exam/generate/route.ts',
  'app/api/generate-lesson-plan/route.ts',
  'app/api/reports/insight/route.ts',
  'app/api/subject-insight/route.ts',
  'app/api/twin/pulse/route.ts',
  'app/api/vibevoice/route.ts',
  'supabase/functions/content-assessment-generate/index.ts',
  'supabase/functions/content-material-generate/index.ts',
  'supabase/functions/curriculum-intelligence-health-action/index.ts',
  'supabase/functions/curriculum-intelligence-research/index.ts',
  'supabase/functions/generate-canonical-lesson-plan/index.ts',
  'supabase/functions/generate-lesson-plan/index.ts',
  'supabase/functions/learning-transform/index.ts',
  'supabase/functions/swift-processor/index.ts',
  'supabase/functions/twin-chat/index.ts',
]);
const violations = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (['node_modules','.next','dist','build'].includes(entry.name)) continue;
    const p = path.join(dir,entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) && !allow.has(p) && !legacyEdgeProviderDebt.has(p)) {
      const text=fs.readFileSync(p,'utf8');
      for (const rule of forbidden) if (rule.test(text)) violations.push(`${p}:${rule}`);
    }
  }
}
for (const root of roots) walk(root);
if (violations.length) throw new Error(`NO_DIRECT_LLM_CALLS violated:\n${violations.join('\n')}`);
for (const debt of legacyEdgeProviderDebt) {
  if (!fs.existsSync(debt)) throw new Error(`STALE_DIRECT_LLM_DEBT_ALLOWLIST:${debt}`);
  const text=fs.readFileSync(debt,'utf8');
  if (!forbidden.some(rule=>rule.test(text))) throw new Error(`DIRECT_LLM_DEBT_MIGRATED_REMOVE_ALLOWLIST:${debt}`);
}
console.log('CYBORG_UNIVERSAL_LLM_GATEWAY_PASS');
