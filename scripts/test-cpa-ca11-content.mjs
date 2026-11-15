import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const sql=readFileSync('supabase/migrations/20261115115000_stage_cpa_ca11_intro_foundation.sql','utf8')
const chunks=[...sql.matchAll(/\$ca11data\$(\{[\s\S]*?\})\$ca11data\$::jsonb/g)]
assert.equal(chunks.length,1,'single source-of-truth authoring packet must remain in migration')
const p=JSON.parse(chunks[0][1])
const check=(p)=>{
 assert.deepEqual(p.metadata.coverage,['1.1','1.2','1.3','1.4','1.5'])
 assert.equal(p.metadata.release_state,'in_review')
 assert.equal(p.topics.length,3)
 assert.equal(p.questions.length,12)
 assert.deepEqual(p.topics.map(t=>t.sequence_number),[1,2,3])
 const slugs=new Set(p.topics.map(t=>t.slug))
 assert.equal(slugs.size,3)
 for(const t of p.topics){
  assert.ok(t.concept_tab.length>=6)
  for(const section of ['concept_tab','kenya_context_tab','common_errors_tab','clinical_tip_tab'])
   for(const b of t[section]) {assert.ok(b.title?.trim());assert.ok(b.text?.trim().length>60)}
 }
 for(const q of p.questions){
  assert.ok(slugs.has(q.topic_slug),'question refers to an existing scoped topic')
  assert.deepEqual(q.options.map(o=>o.id),['a','b','c','d'])
  assert.ok(q.options.some(o=>o.id===q.correct_option_id),'answer key must be an actual option')
  assert.ok(q.explanation.trim().length>65,'answer must have substantive feedback')
 }
 const keys=p.questions.map(q=>q.question_text)
 assert.equal(new Set(keys).size,12,'unique question authority')
 assert.ok(p.metadata.sources.some(s=>s.url.includes('kasneb.or.ke')))
 assert.ok(p.metadata.sources.some(s=>s.url.includes('ifrs.org')))
}
check(p)
assert.throws(()=>check({...p, questions:p.questions.map((q,i)=>i===0?{...q,correct_option_id:'z'}:q)}),/answer key/)
assert.throws(()=>check({...p, metadata:{...p.metadata,coverage:['1.1']}}))
assert.match(sql,/status='coming_soon'/)
assert.match(sql,/content_status='in_review'/)
assert.match(sql,/create temporary table vibeschool_ca11_packet/)
assert.match(sql,/on commit drop/)
assert.doesNotMatch(sql,/(?:set\s+status\s*=\s*'live'|content_status\s*,?\s*'published'|grant\s+select|disable\s+row\s+level\s+security)/i)
const ownerCapital=120000, laptop=40000, stock=30000, supplierPayment=10000, fees=15000, drawings=5000
const cash=ownerCapital-laptop-supplierPayment+fees-drawings
const assets=cash+laptop+stock
const liability=stock-supplierPayment
const equity=ownerCapital+fees-drawings
assert.equal(cash,80000)
assert.equal(assets,150000)
assert.equal(liability,20000)
assert.equal(equity,130000)
assert.equal(assets,liability+equity)
assert.equal(65000+14000+21000-(25000+5000),70000)
assert.equal(70000+40000+20000-25000,105000)
assert.equal(180000-65000,115000)
console.log('PASS: KASNEB 1.1-1.5 scoped content, source trail, 3 topics/12 keyed questions, worked accounting equation and negative controls; publication still blocked')
