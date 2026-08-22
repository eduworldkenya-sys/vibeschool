import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = 'CYBORG_CHAT_SESSION_REQUIRED';
const providerPatterns = [
  /api\.groq\.com\/openai\/v1\/chat\/completions/,
  /api\.anthropic\.com\/v1\/messages/,
  /api\.openai\.com\/v1\//,
  /generativelanguage\.googleapis\.com\//,
  /new\s+Anthropic\s*\(/,
  /new\s+OpenAI\s*\(/,
];

const chatEntries = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) && /(^|[\\/])chat([\\/.-]|$)|twin-chat/i.test(p)) chatEntries.push(p);
  }
}
walk('app/api');
walk('supabase/functions');

if (!chatEntries.includes(path.join('supabase','functions','twin-chat','index.ts'))) {
  throw new Error('CYBORG_CHAT_PRIMARY_ENTRY_MISSING');
}

const violations = [];
for (const p of chatEntries) {
  const text = fs.readFileSync(p, 'utf8');
  const callsProvider = providerPatterns.some((rule) => rule.test(text));
  if (callsProvider) {
    if (!text.includes(REQUIRED)) violations.push(`${p}:missing_${REQUIRED}`);
    if (!text.includes('missionId')) violations.push(`${p}:missing_mission_identity`);
    if (!text.includes('callCyborgChatModel')) violations.push(`${p}:provider_call_not_behind_cyborg_chat_gateway`);
  }
}

const client = fs.readFileSync('lib/student/twin.ts', 'utf8');
for (const invariant of ['learnerTwinMissionId','missionId: learnerTwinMissionId','payload.missionId']) {
  if (!client.includes(invariant)) violations.push(`lib/student/twin.ts:missing_${invariant}`);
}

const twinChat = fs.readFileSync('supabase/functions/twin-chat/index.ts', 'utf8');
for (const invariant of [REQUIRED,'createOrResumeCyborgChatMission','callCyborgChatModel','missionId']) {
  if (!twinChat.includes(invariant)) violations.push(`supabase/functions/twin-chat/index.ts:missing_${invariant}`);
}
if (/async function callGroq\s*\(/.test(twinChat)) violations.push('supabase/functions/twin-chat/index.ts:legacy_callGroq_present');

if (violations.length) throw new Error(`CYBORG_CHAT_SESSION_GATEWAY_VIOLATION:\n${violations.join('\n')}`);
console.log(`CYBORG_CHAT_SESSION_GATEWAY_PASS entries=${chatEntries.length}`);
