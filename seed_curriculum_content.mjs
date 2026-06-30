/**
 * seed_curriculum_content.mjs
 *
 * Runs once from Termux to pre-seed curriculum_content for all 299
 * curriculum rows. Groups by grade+subject+term to batch prompts,
 * minimising API calls. Skips rows already seeded.
 *
 * Usage:
 *   node seed_curriculum_content.mjs
 *
 * Requires these env vars (same ones Vercel already has):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *
 * Safe to re-run — uses upsert, skips already-seeded units.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing env vars. Export NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── 1. Fetch all curriculum rows ─────────────────────────────────────────────
const { data: units, error: fetchErr } = await sb
  .from('curriculum')
  .select('id, grade, subject, strand, sub_strand, topic, week, term, academic_year')
  .order('grade').order('subject').order('term').order('week');

if (fetchErr) { console.error('Failed to fetch curriculum:', fetchErr.message); process.exit(1); }
console.log(`Fetched ${units.length} curriculum units`);

// ── 2. Fetch already-seeded unit IDs to skip ─────────────────────────────────
const { data: existing } = await sb
  .from('curriculum_content')
  .select('curriculum_unit_id');

const seededIds = new Set((existing ?? []).map(r => r.curriculum_unit_id));
const pending   = units.filter(u => !seededIds.has(u.id));
console.log(`Already seeded: ${seededIds.size}. To seed: ${pending.length}`);

if (pending.length === 0) { console.log('All units seeded. Nothing to do.'); process.exit(0); }

// ── 3. Process one unit at a time with a delay to avoid rate limits ──────────
let done = 0;
let failed = 0;

for (const unit of pending) {
  try {
    const content = await generateContent(unit);
    const { error: upsertErr } = await sb
      .from('curriculum_content')
      .upsert({
        curriculum_unit_id:  unit.id,
        lesson_plan_template: content.lesson_plan_template,
        board_summary:        content.board_summary,
        quiz_questions:       content.quiz_questions,
        homework_tasks:       content.homework_tasks,
        cat_questions:        content.cat_questions,
        remedial_activities:  content.remedial_activities,
        seeded_by:            'seed_script_v1',
        updated_at:           new Date().toISOString(),
      }, { onConflict: 'curriculum_unit_id' });

    if (upsertErr) {
      console.error(`  ✗ DB error for ${unit.grade}/${unit.subject} W${unit.week}: ${upsertErr.message}`);
      failed++;
    } else {
      done++;
      console.log(`  ✓ [${done}/${pending.length}] ${unit.grade} · ${unit.subject} · W${unit.week} · ${unit.topic}`);
    }
  } catch (e) {
    console.error(`  ✗ Failed: ${unit.grade}/${unit.subject} W${unit.week}: ${e.message}`);
    failed++;
  }

  // 1.2s gap between calls — stays under Anthropic rate limits comfortably
  await sleep(1200);
}

console.log(`\nDone. Seeded: ${done}. Failed: ${failed}.`);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function generateContent(unit) {
  const prompt = `You are a Kenyan CBC curriculum expert generating structured teaching content.

UNIT:
  Grade:      ${unit.grade}
  Subject:    ${unit.subject}
  Strand:     ${unit.strand}
  Sub-strand: ${unit.sub_strand}
  Topic:      ${unit.topic}
  Term:       ${unit.term}  Week: ${unit.week}

Generate a complete JSON object (no markdown, no explanation, raw JSON only) with these exact keys:

{
  "lesson_plan_template": {
    "objectives": ["string — max 3, starts with action verb"],
    "key_questions": ["string — 2 inquiry questions"],
    "activities": [
      { "phase": "Introduction|Development|Conclusion", "description": "string", "duration_mins": number }
    ],
    "resources": ["string"],
    "assessment_criteria": "string"
  },
  "board_summary": "string — what goes on the chalkboard: title, key points, diagrams described in text, max 120 words",
  "quiz_questions": [
    { "question": "string", "options": ["A","B","C","D"], "answer": "A|B|C|D", "marks": 1 }
  ],
  "homework_tasks": [
    { "instruction": "string", "type": "written|oral|practical" }
  ],
  "cat_questions": [
    { "question": "string", "marks": number, "rubric": "string — what EE/ME/AE/BE looks like" }
  ],
  "remedial_activities": [
    { "activity": "string", "target": "below_expectation|approaches_expectation" }
  ]
}

Rules:
- quiz_questions: exactly 4 items, CBC-aligned, appropriate for ${unit.grade}
- homework_tasks: exactly 2 items
- cat_questions: exactly 2 items
- remedial_activities: exactly 2 items (one per target level)
- All content must align with Kenya CBC competencies for ${unit.grade}
- Language appropriate for ${unit.grade} teachers reading the content
- Return ONLY the JSON object. No markdown. No explanation.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = (data.content ?? []).map(b => b.text ?? '').join('');
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
