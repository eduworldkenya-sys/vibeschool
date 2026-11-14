import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const manifest=JSON.parse(readFileSync('content/topic-practice/grade4-mathematics-place-value-001.json','utf8'))
const publisher=readFileSync('scripts/sql/publish_g4_math_place_value_topic_practice_001.sql','utf8')
test('original Grade 4 practice has five valid keyed questions',()=>{
  assert.equal(manifest.questions.length,5)
  assert.equal(manifest.status,'awaiting_curriculum_verification')
  assert.equal(manifest.outcome_candidate.binding_allowed,false)
  assert.equal(new Set(manifest.questions.map(q=>q.id)).size,5)
  for(const q of manifest.questions){
    assert.equal(q.options.length,4)
    assert.deepEqual(q.options.map(x=>x.value),['A','B','C','D'])
    assert.ok(q.options.some(x=>x.value===q.correct_answer))
    assert.ok(q.prompt.trim().length>10)
    assert.ok(q.explanation.trim().length>20)
  }
})
test('publisher uses the existing EXQ canonical tables and refuses unverified outcomes',()=>{
  for(const name of ['curriculum_authority_promotions','curriculum_authority_sources','curriculum_authority_snapshots',
    'assessment_definitions','assessment_items','assessment_item_outcomes','assessment_assignments'])
    assert.match(publisher,new RegExp(name))
  assert.match(publisher,/o\.verified_at IS NOT NULL/)
  assert.match(publisher,/o\.source_type='official'/)
  assert.match(publisher,/release_blocked/)
  assert.match(publisher,/time_limit_minutes,max_attempts/)
  assert.match(publisher,/'immediate','after_release'/)
  assert.match(publisher,/v_count<>5/)
  assert.doesNotMatch(publisher,/create\s+table/i)
})
