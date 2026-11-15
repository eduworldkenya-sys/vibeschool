import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const source = read('lib/assessment/self-review-criteria.ts')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const { parseSelfReviewItems } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const valid = () => ({
  ok: true,
  items: [{
    assessment_item_id: 'question-001',
    criteria: [
      { id: 'evaporation', label: 'Water evaporates', marks: 1 },
      { id: 'condensation', label: 'Water condenses', marks: 1 },
    ],
    max_score: 2,
    self_review_score: 1,
    selected_ids: ['evaporation'],
    unsure: false,
    reviewed_at: '2026-11-15T01:00:00Z',
  }],
})

test('point-form self-marking gives stable saved points and learner provenance', () => {
  const [item] = parseSelfReviewItems(valid())
  assert.equal(item.assessmentItemId, 'question-001')
  assert.deepEqual(item.criteria.map(c => c.id), ['evaporation', 'condensation'])
  assert.deepEqual(item.selectedIds, ['evaporation'])
  assert.equal(item.selfReviewScore, 1)
})

test('malformed and overmarked rubrics are never rendered as checkboxes', () => {
  for (const badCriteria of [
    ['evaporation', 'condensation'],
    [{ id: 'a', label: 'A', marks: 2 }, { id: 'b', label: 'B', marks: 2 }],
    [{ id: 'a', label: 'A', marks: 1 }, { id: 'a', label: 'B', marks: 1 }],
    [{ id: 'a', label: 'A', marks: 0 }],
    [],
  ]) {
    const example = valid()
    example.items[0].criteria = badCriteria
    assert.deepEqual(parseSelfReviewItems(example), [])
  }
})

test('unverified or missing review data rejects unsafe render', () => {
  assert.throws(() => parseSelfReviewItems({ ok: false, items: [] }))
  assert.throws(() => parseSelfReviewItems({ ok: true, items: null }))
  const uncertain = valid()
  uncertain.items[0].self_review_score = null
  uncertain.items[0].unsure = true
  assert.equal(parseSelfReviewItems(uncertain)[0].selfReviewScore, null)
})

test('server authorizes only owned released answers and validates criterion scores', () => {
  const sql = read('supabase/migrations/20261115040500_exq_learner_self_review.sql')
  for (const guard of [
    /auth\.uid\(\) is null/,
    /s\.profile_id=auth\.uid\(\)/,
    /v_attempt\.status<>'released'/,
    /v_attempt\.result_status<>'released'/,
    /answer_review_policy='after_close'/,
    /answer_review_policy='after_release'/,
    /jsonb_typeof\(v_criterion->'marks'\)<>'number'/,
    /v_max_criteria>v_item\.marks/,
    /cannot_award_unanswered_response/,
    /count\(distinct x\.id\)/,
    /revoke all on function public\.exq_get_my_self_review/,
    /revoke all on function public\.exq_set_my_self_review/,
    /self_review_score=case when p_unsure then null else v_awarded end/,
  ]) assert.match(sql, guard)
  assert.doesNotMatch(sql, /update public\.assessment_attempts|update public\.assessment_gradebook_entries|update public\.exam_results/i)
})

test('student marks remain separate and hidden answers stay hidden', () => {
  const results = read('app/student/results/[attemptId]/page.tsx')
  const panel = read('components/student/exams/SelfReviewPanel.tsx')
  assert.match(results, /data\.answersRevealed/)
  assert.match(panel, /Your answer is already locked/)
  assert.match(panel, /not an independently verified exam score/)
  assert.match(results, /Learner self-awarded:/)
  assert.match(panel, /I'm not sure how to mark this answer/)
  const player = read('app/student/assessment/[assignmentId]/page.tsx')
  assert.match(player, /item\.questionType === 'numeric'/)
  assert.match(player, /inputMode="decimal"/)
  const canonical = read('supabase/migrations/20261110030100_exq_submit_idempotent_receipts.sql')
  assert.match(canonical, /item_rec\.auto_marking_mode='numeric_tolerance'/)
  assert.match(canonical, /awarded:=case when abs/)
})
