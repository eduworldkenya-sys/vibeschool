import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const source=JSON.parse(fs.readFileSync(path.join(root,'content/curriculum/grade6/mathematics/fractions-addition.v1.editorial.json'),'utf8'))
const manuscript=fs.readFileSync(path.join(root,'content/curriculum/production/grade6-fractions-addition-20261113.md'),'utf8')
assert.equal(source.grade,'Grade 6')
assert.equal(source.subject,'Mathematics')
assert.equal(source.sub_strand,'Fractions')
assert.equal(source.canonical.sub_strand_id,'d8f452e0-3270-4389-ad86-646af8f26f6d')
assert.equal(source.canonical.curriculum_outcome_id,'65cc88b5-0767-4c09-965c-0ce562f3fdae')
assert.equal(source.canonical.outcome_code,'VS-G6-MA-1.4-1')
assert.ok(source.publication.status.includes('NOT_CERTIFIED_NOT_PUBLISHED'))
assert.equal(source.worked_examples.length,8)
assert.equal(source.practice_questions.length,63)
assert.equal(new Set(source.practice_questions.map(q=>q.id)).size,63)
for (const q of source.practice_questions){
  assert.ok(q.prompt && q.answer && q.explanation,`incomplete practice Q${q.number}`)
  assert.ok(!/KICD|VS-G6-/i.test(q.prompt),'private code/authority leaked in pupil prompt')
}
assert.equal(source.visible_bank_candidates.length,20)
assert.ok(source.visible_bank_candidates.every(q=>q.status==='exposed_draft_not_unseen_exam'))
assert.equal(source.quick_check_mcqs.length,5)
for(const q of source.quick_check_mcqs){
 assert.ok(q.correct>=0 && q.correct<q.options.length)
 assert.ok(q.why)
}
assert.equal(source.visual_models.length,4)
for(const a of source.visual_models){
 assert.equal(a.registered_in_visual_library,false)
 assert.ok(fs.existsSync(path.join(root,'content/curriculum/production/grade6-fractions-addition-assets',a.filename)))
 assert.ok(manuscript.includes(a.filename))
}
assert.ok(source.practice_questions.find(q=>q.number===44).answer.includes('1 1/14'))
assert.ok(manuscript.includes('5/12 + 1/4 = 5/12 + 3/12'))

const reader=JSON.parse(fs.readFileSync(path.join(root,'content/curriculum/grade6/mathematics/fractions-addition.v1.reader-candidate.json'),'utf8'))
assert.equal(reader.schema,'vibeschool.originals.lesson-content.v1')
assert.equal(reader.canonical_sub_strand_id,source.canonical.sub_strand_id)
assert.deepEqual(reader.canonical_curriculum_outcome_ids,[source.canonical.curriculum_outcome_id])
assert.deepEqual(reader.learning_outcome_ids,[source.canonical.outcome_code])
assert.deepEqual(reader.sections.map(s=>s.id),['learn','worked_examples','activities','practice','feedback','revision'])
assert.ok(reader.sections.every(s=>s.body.length>200 && s.title && s.tone))
assert.equal(reader.questions.length,63)
assert.ok(reader.questions.every(q=>q.prompt && q.answer && q.explanation))
assert.ok(!reader.content_text.includes('## WORKED ANSWER AND FEEDBACK GUIDE'))
assert.ok(reader.sections.find(s=>s.id==='feedback').body.includes('44.'))
assert.equal(reader.asset_references.length,4)
assert.ok(reader.asset_references.every(x=>x.production_visual_id===null && x.status==='editorial_source_not_certified'))
assert.equal(reader.release_gate.status,'not_certified_not_published')
assert.ok(reader.teacher_guidance.full_text.length>2000)
assert.ok(!source.review_record.published)
console.log('PASS Grade 6 Fractions editorial: existing curriculum identity, 63 worked answers, 20 exposed bank candidates, 4 editorial visual sources and protected publication flags')
