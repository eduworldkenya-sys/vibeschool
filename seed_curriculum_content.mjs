/**
 * One-time curriculum seed utility. Model access is admitted and executed only through Cyborg.
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: CYBORG_ADMISSION_URL, CYBORG_LLM_GATEWAY_URL.
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMISSION_URL = process.env.CYBORG_ADMISSION_URL || `${SUPABASE_URL}/functions/v1/cyborg-admission`;
const GATEWAY_URL = process.env.CYBORG_LLM_GATEWAY_URL || `${SUPABASE_URL}/functions/v1/cyborg-llm-gateway`;
const CALLER = 'script.seed-curriculum-content';
const PROVIDER = 'anthropic';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1500;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const hashValue = (value) => createHash('sha256').update(value).digest('base64url');

async function invokeCyborg(unit, prompt) {
  const messages = [{ role: 'user', content: prompt }];
  const metadata = { feature: 'seed-curriculum-content', temperature: 0.25 };
  const requestHash = hashValue(JSON.stringify({ callerServiceId: CALLER, provider: PROVIDER, model: MODEL, operation: 'model.generate', maxTokens: MAX_TOKENS, messages, metadata }));
  const admissionRes = await fetch(ADMISSION_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${SERVICE_KEY}`, 'x-cyborg-caller-id': CALLER },
    body: JSON.stringify({ actorKey: 'system:curriculum-seed', externalChatId: `curriculum-seed:${unit.id}`, objective: `Seed governed curriculum content for ${unit.grade} ${unit.subject} ${unit.topic}`, callerServiceId: CALLER, provider: PROVIDER, model: MODEL, operation: 'model.generate', requestHash, maxTokens: MAX_TOKENS, riskClass: 'read', dataClassification: 'internal', authorityScope: [], toolScope: [] }),
  });
  const admission = await admissionRes.json().catch(() => ({}));
  if (!admissionRes.ok || !admission.capability) throw new Error(`Cyborg admission failed: ${admission.error || admissionRes.status}`);
  const gatewayRes = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Cyborg ${admission.capability}`, 'x-cyborg-caller-id': CALLER },
    body: JSON.stringify({ missionId: admission.missionId, missionRevision: admission.missionRevision, chatId: admission.chatId, invocationId: admission.invocationId, callerServiceId: CALLER, provider: PROVIDER, model: MODEL, operation: 'model.generate', maxTokens: MAX_TOKENS, messages, metadata }),
  });
  const payload = await gatewayRes.json().catch(() => ({}));
  if (!gatewayRes.ok) throw new Error(`Cyborg gateway failed: ${payload.error || gatewayRes.status}`);
  if (payload?.lineage?.lineageVerified !== true || payload?.lineage?.policyDecision !== 'ALLOW' || !payload?.lineage?.receiptHash) throw new Error('CYBORG_LINEAGE_REQUIRED');
  const content = payload?.output?.output?.content;
  const text = Array.isArray(content) ? content.map((b) => b?.text ?? '').join('') : '';
  if (!text.trim()) throw new Error('Empty Cyborg model response');
  return { text, missionId: admission.missionId, invocationId: admission.invocationId };
}

const { data: units, error: fetchErr } = await sb.from('curriculum').select('id, grade, subject, strand, sub_strand, topic, week, term, academic_year').order('grade').order('subject').order('term').order('week');
if (fetchErr) { console.error('Failed to fetch curriculum:', fetchErr.message); process.exit(1); }
const { data: existing } = await sb.from('curriculum_content').select('curriculum_unit_id');
const seededIds = new Set((existing ?? []).map(r => r.curriculum_unit_id));
const pending = units.filter(u => !seededIds.has(u.id));
console.log(`Fetched ${units.length}; already seeded ${seededIds.size}; pending ${pending.length}`);
if (!pending.length) process.exit(0);

let done = 0, failed = 0;
for (const unit of pending) {
  try {
    const content = await generateContent(unit);
    const { error: upsertErr } = await sb.from('curriculum_content').upsert({ curriculum_unit_id: unit.id, lesson_plan_template: content.lesson_plan_template, board_summary: content.board_summary, quiz_questions: content.quiz_questions, homework_tasks: content.homework_tasks, cat_questions: content.cat_questions, remedial_activities: content.remedial_activities, seeded_by: 'cyborg_seed_script_v2', updated_at: new Date().toISOString() }, { onConflict: 'curriculum_unit_id' });
    if (upsertErr) throw upsertErr;
    done++; console.log(`✓ [${done}/${pending.length}] ${unit.grade} · ${unit.subject} · W${unit.week} · ${unit.topic}`);
  } catch (e) { failed++; console.error(`✗ ${unit.grade}/${unit.subject} W${unit.week}: ${e.message}`); }
  await new Promise(resolve => setTimeout(resolve, 1200));
}
console.log(`Done. Seeded: ${done}. Failed: ${failed}.`);

async function generateContent(unit) {
  const prompt = `You are a Kenyan CBC curriculum expert generating structured teaching content.\n\nUNIT:\nGrade: ${unit.grade}\nSubject: ${unit.subject}\nStrand: ${unit.strand}\nSub-strand: ${unit.sub_strand}\nTopic: ${unit.topic}\nTerm: ${unit.term} Week: ${unit.week}\n\nReturn raw JSON only with keys lesson_plan_template, board_summary, quiz_questions, homework_tasks, cat_questions, remedial_activities. lesson_plan_template must contain objectives, key_questions, activities, resources, assessment_criteria. quiz_questions exactly 4; homework_tasks exactly 2; cat_questions exactly 2; remedial_activities exactly 2. Align to Kenya CBC competencies for ${unit.grade}.`;
  const governed = await invokeCyborg(unit, prompt);
  return JSON.parse(governed.text.replace(/```json|```/g, '').trim());
}
