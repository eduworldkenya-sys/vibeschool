import fs from 'node:fs';
import path from 'node:path';

const gateway = fs.readFileSync('lib/cyborg/gateway.ts', 'utf8');
for (const invariant of ['runCyborgMission','NO_DIRECT_LLM_CALLS','PREMATURE_MISSION_RETURN','CYBORG_MISSION_REQUIRED','CyborgUniversalGateway','invokeCyborgModel']) {
  if (!gateway.includes(invariant)) throw new Error(`CYBORG_GATEWAY_INVARIANT_MISSING:${invariant}`);
}

// Scan every server/runtime model-authority surface plus repository automation.
// Browser-only pages cannot possess server provider credentials, while app/api,
// server libraries, Edge Functions, scripts and Actions can create a real bypass.
const runtimeRoots = ['app/api','lib','components','scripts','supabase/functions','seed_curriculum_content.mjs'];
const runtimeForbidden = [
  /new\s+OpenAI\s*\(/,
  /new\s+Anthropic\s*\(/,
  /new\s+GoogleGenerativeAI\s*\(/,
  /openai\.responses\.create\s*\(/,
  /anthropic\.messages\.create\s*\(/,
  /api\.groq\.com\/openai\/v1\//,
  /api\.anthropic\.com\/v1\/messages/,
  /api\.openai\.com\/v1\//,
  /generativelanguage\.googleapis\.com\//,
  /\bGROQ_API_KEY\b/,
  /\bANTHROPIC_API_KEY\b/,
  /\bOPENAI_API_KEY\b/,
  /\bGEMINI_API_KEY\b/,
  /\bGOOGLE_AI_API_KEY\b/,
];
const workflowForbidden = [
  /https?:\/\/(?:api\.)?(?:openai\.com|anthropic\.com|groq\.com)\b/i,
  /\$\{\{\s*secrets\.(?:GROQ_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|GOOGLE_AI_API_KEY)\s*\}\}/,
];
const allow = new Set([
  'lib/cyborg/gateway.ts',
  'scripts/validate-cyborg-llm-gateway.mjs',
  'supabase/functions/cyborg-llm-gateway/index.ts',
]);
const violations = [];
function walk(dir, rules, extensions) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    inspect(dir.split(path.sep).join('/'), rules, extensions);
    return;
  }
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (['node_modules','.next','dist','build'].includes(entry.name)) continue;
    const p = path.join(dir,entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) walk(p, rules, extensions);
    else inspect(p, rules, extensions);
  }
}
function inspect(p, rules, extensions) {
  if (!extensions.test(p) || allow.has(p)) return;
  const text = fs.readFileSync(p,'utf8');
  for (const rule of rules) {
    rule.lastIndex = 0;
    if (rule.test(text)) violations.push(`${p}:${rule}`);
  }
}
for (const root of runtimeRoots) walk(root, runtimeForbidden, /\.(ts|tsx|js|mjs|cjs)$/);
walk('.github/workflows', workflowForbidden, /\.(yml|yaml)$/);
if (violations.length) throw new Error(`NO_DIRECT_LLM_CALLS violated:\n${violations.join('\n')}`);
console.log('CYBORG_UNIVERSAL_LLM_GATEWAY_PASS');
