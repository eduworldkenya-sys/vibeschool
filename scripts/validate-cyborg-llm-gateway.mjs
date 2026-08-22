import fs from 'node:fs';
import path from 'node:path';

const gateway = fs.readFileSync('lib/cyborg/gateway.ts', 'utf8');
for (const invariant of ['runCyborgMission','NO_DIRECT_LLM_CALLS','PREMATURE_MISSION_RETURN','CYBORG_MISSION_REQUIRED','CyborgUniversalGateway','invokeCyborgModel']) {
  if (!gateway.includes(invariant)) throw new Error(`CYBORG_GATEWAY_INVARIANT_MISSING:${invariant}`);
}

// Scan server-side/runtime authority surfaces. Legacy browser-only inference is not
// treated as an execution authority and is migrated independently.
const roots = ['app/api','lib','components','scripts'];
const forbidden = [
  /new\s+OpenAI\s*\(/,
  /new\s+Anthropic\s*\(/,
  /new\s+GoogleGenerativeAI\s*\(/,
  /openai\.responses\.create\s*\(/,
  /anthropic\.messages\.create\s*\(/,
  /api\.anthropic\.com\/v1\/messages/,
  /api\.openai\.com\/v1\//,
  /generativelanguage\.googleapis\.com\//,
];
const allow = new Set(['lib/cyborg/gateway.ts','scripts/validate-cyborg-llm-gateway.mjs']);
const violations = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (['node_modules','.next','dist','build'].includes(entry.name)) continue;
    const p = path.join(dir,entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) && !allow.has(p)) {
      const text=fs.readFileSync(p,'utf8');
      for (const rule of forbidden) if (rule.test(text)) violations.push(`${p}:${rule}`);
    }
  }
}
for (const root of roots) walk(root);
if (violations.length) throw new Error(`NO_DIRECT_LLM_CALLS violated:\n${violations.join('\n')}`);
console.log('CYBORG_UNIVERSAL_LLM_GATEWAY_PASS');
