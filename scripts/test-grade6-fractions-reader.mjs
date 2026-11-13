import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
const root=process.cwd()
const read=p=>fs.readFileSync(path.join(root,p),'utf8')
const sql=read('supabase/migrations/20261113090000_grade6_fractions_certified_reader.sql')
const client=read('components/learn/Grade6FractionsContentReader.tsx')
const app=read('app/learn/grade-6/mathematics/fractions/page.tsx')
const catalogue=read('lib/learn/schoolCatalog.ts')
const payload=JSON.parse(read('content/curriculum/grade6/mathematics/fractions-addition.v1.release-candidate.json'))
assert.match(sql,/vs_public_grade6_fractions_addition_learner_lesson/)
assert.match(sql,/security definer set search_path = ''/)
for (const term of [
  "v.lifecycle_status='certified'","v.rights_status='cleared'",
  "r.status='active'","r.visibility='public'",
  "r.curriculum_outcome_id='65cc88b5-0767-4c09-965c-0ce562f3fdae'",
  "r.canonical_key='vs:g6:mathematics:fractions:addition:learner:lesson:01'",
  "v.content_sha256=encode","public.fn_learning_resource_visible(r.id)","limit 1",
  "grant execute on function public.vs_public_grade6_fractions_addition_learner_lesson()"
])assert.ok(sql.includes(term),term)
assert.match(client,/supabase.rpc\('vs_public_grade6_fractions_addition_learner_lesson'\)/)
assert.match(client,/<UniversalLearnReader/)
assert.match(client,/buildLearningToolContext/)
assert.match(client,/fraction/)
assert.match(client,/lesson is not currently published/)
assert.match(client,/No score is stored in an exam record/)
assert.ok(!client.includes('service_role')&&!client.includes('from(\\x27learning_resource_versions'))
assert.match(app,/Grade6FractionsContentReader/)
assert.match(catalogue,/\/learn\/grade-6\/mathematics\/fractions/)
assert.equal(payload.schema,'vibeschool.originals.lesson-content.v1')
assert.equal(payload.sections.length,6)
assert.equal(payload.questions.length,63)
assert.equal(payload.quick_check_mcqs.length,5)
assert.equal(payload.bank_candidates.length,20)
assert.deepEqual(payload.canonical_curriculum_outcome_ids,['65cc88b5-0767-4c09-965c-0ce562f3fdae'])
assert.ok(payload.sections[0].tools.some(x=>x.id==='fraction-bars'))
assert.ok(!JSON.stringify(payload.sections).includes('grade6-fractions-addition-assets/'))
assert.ok(payload.questions.every(q=>q.prompt&&q.answer&&q.explanation))
assert.ok(payload.quick_check_mcqs.every(q=>q.correct>=0&&q.correct<q.options.length&&q.why))
console.log('PASS Grade 6 published reader contract: certified-only scope, canonical ID, 63 practice items, native fraction tool')
