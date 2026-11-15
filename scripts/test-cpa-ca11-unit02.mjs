import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root='content/college/cpa/ca11/unit02/'
const readJSON=file=>JSON.parse(readFileSync(root+file,'utf8'))
const manifest=readJSON('manifest.json')
const topics=[...readJSON('topics-a.json'),...readJSON('topics-b.json')]
const questions=readJSON('questions.json')
const stage=readFileSync('supabase/migrations/20261115133937_stage_cpa_ca11_accounting_workshops.sql','utf8')
const release=readFileSync('supabase/migrations/20261115134518_release_cpa_ca11_accounting_workshops.sql','utf8')
const original=readFileSync('supabase/migrations/20261115124103_stage_cpa_ca11_intro_foundation.sql','utf8')

const expectedSlugs=[
 'source-documents-and-evidence','books-of-original-entry','double-entry-ledgers',
 'trial-balance-from-ledgers','statements-from-the-trial-balance'
]
const check=(m,t,q)=>{
 assert.equal(m.paper,'CA11 Financial Accounting')
 assert.equal(m.qualification,'KASNEB CPA')
 assert.equal(m.source_version,'2024-06')
 assert.deepEqual(m.coverage,['2.1','2.2','2.3','2.4','2.5'])
 assert.equal(m.release_state,'in_review')
 assert.equal(m.unit,'02B')
 assert.equal(m.existing_core_question_count,14)
 assert.ok(m.sources.some(x=>x.authority==='KASNEB'&&x.url.includes('kasneb.or.ke')))
 assert.ok(m.sources.some(x=>x.authority==='IFRS Foundation'))
 assert.ok(m.sources.some(x=>x.authority==='ACCA'))
 assert.deepEqual(t.map(x=>x.slug),expectedSlugs)
 assert.deepEqual(t.map(x=>x.sequence_number),[7,8,9,10,11])
 assert.equal(new Set(t.map(x=>x.slug)).size,5)
 assert.equal(q.length,30)
 assert.equal(new Set(q.map(x=>x.question_text)).size,30)
 for(const topic of t) {
  assert.ok(topic.concept_tab.length>=7,'substantive teaching in '+topic.slug)
  for(const field of ['concept_tab','kenya_context_tab','common_errors_tab','clinical_tip_tab']){
   assert.ok(topic[field].length>=1,topic.slug+' missing '+field)
   for(const block of topic[field]){
    assert.ok(typeof block.title==='string'&&block.title.length>=7)
    assert.ok(typeof block.text==='string'&&block.text.length>=70,topic.slug+' weak '+field)
   }
  }
  assert.equal(q.filter(item=>item.topic_slug===topic.slug).length,6,'6 guided items per syllabus outcome')
 }
 for(const question of q){
  assert.ok(expectedSlugs.includes(question.topic_slug),'question points to released topic')
  assert.ok(question.question_text.length>=55)
  assert.deepEqual(question.options.map(x=>x.id),['a','b','c','d'])
  assert.ok(question.options.every(x=>x.text.trim().length>=8))
  assert.ok(question.options.some(x=>x.id===question.correct_option_id),'valid answer')
  assert.ok(question.explanation.length>=75,'specific feedback')
 }
 const tx=m.case_transactions
 assert.equal(tx.length,9,'nine real journal entries, no invented transaction')
 assert.equal(m.case_unposted_event.quoted_amount,9000)
 const balances={}
 for(const event of tx){
  assert.ok(event.amount>0)
  balances[event.debit]=(balances[event.debit]??0)+event.amount
  balances[event.credit]=(balances[event.credit]??0)-event.amount
 }
 assert.deepEqual(balances,m.expected_balances)
 const debit=Object.values(balances).filter(n=>n>0).reduce((a,b)=>a+b,0)
 const credit=-Object.values(balances).filter(n=>n<0).reduce((a,b)=>a+b,0)
 assert.equal(debit,263000);assert.equal(credit,263000)
 assert.equal(m.expected_totals.trial_debits,debit)
 assert.equal(m.expected_totals.trial_credits,credit)
 const income=-balances.revenue
 const expense=balances.rent+balances.advertising
 assert.equal(m.expected_totals.monthly_revenue,income)
 assert.equal(m.expected_totals.monthly_expenses,expense)
 const profit=income-expense
 assert.equal(profit,60000)
 assert.equal(profit,m.expected_totals.monthly_profit)
 const assets=balances.bank+balances.equipment+balances.receivables
 const liability=-balances.payables
 const equity=-balances.capital+profit-balances.drawings
 assert.equal(assets,239000);assert.equal(liability,3000);assert.equal(equity,236000)
 assert.equal(assets,liability+equity)
 assert.equal(assets,m.expected_totals.assets)
 assert.equal(liability,m.expected_totals.liabilities)
 assert.equal(equity,m.expected_totals.equity)
 assert.ok(t.find(x=>x.slug==='double-entry-ledgers').concept_tab.some(x=>x.text.includes('quotation')))
 assert.ok(t.find(x=>x.slug==='trial-balance-from-ledgers').concept_tab.some(x=>x.text.includes('263,000')))
 assert.ok(t.find(x=>x.slug==='statements-from-the-trial-balance').concept_tab.some(x=>x.text.includes('236,000')))
}
check(manifest,topics,questions)

// The migration must carry exactly the editorially audited JSON and no stale copy.
const packets=[...stage.matchAll(/\$workshopdata\$(\{[\s\S]*?\})\$workshopdata\$::jsonb/g)]
assert.equal(packets.length,1)
assert.deepEqual(JSON.parse(packets[0][1]),{manifest,topics,questions})

assert.match(stage,/status='live'/)
assert.match(stage,/content_status='in_review'/)
assert.match(stage,/create temporary table vibeschool_ca11_workshop_packet/)
assert.match(stage,/on commit drop/)
assert.match(stage,/v_published<>6/)
assert.match(stage,/v_existing<>6/)
assert.match(stage,/v_new_topics<>5/)
assert.match(stage,/v_new_questions<>30/)
assert.doesNotMatch(stage,/update\s+public\.topics\s+set\s+content_status\s*=\s*'published'/i)
assert.doesNotMatch(stage,/(?:disable row level security|grant\s+select|update\s+public\.courses|delete\s+from\s+public\.topics)/i)

assert.match(release,/v_review<>5/)
assert.match(release,/v_total<>11/)
assert.match(release,/v_questions<>30/)
assert.match(release,/v_wrong<>0/)
assert.match(release,/v_changed<>5/)
assert.match(release,/v_intro<>3/)
assert.match(release,/v_core<>3/)
assert.match(release,/v_prevquestions<>26/)
assert.match(release,/status='live'/)
assert.match(release,/update public\.topics set content_status='published'/)
assert.doesNotMatch(release,/(?:update\s+public\.courses|delete\s+from\s+public\.quiz_questions|disable row level security)/i)
for(const q of questions){
 const quote=s=>s.replaceAll("'","''")
 const assertion=`('${quote(q.topic_slug)}','${quote(q.question_text)}','${q.correct_option_id}')`
 assert.ok(release.includes(assertion),'publish gate must preserve exact question+correct answer')
}
const intro=JSON.parse([...original.matchAll(/\$ca11data\$(\{[\s\S]*?\})\$ca11data\$::jsonb/g)][0][1])
assert.equal(intro.topics.length,3);assert.equal(intro.questions.length,12)
assert.ok(topics.every(t=>!intro.topics.some(x=>x.slug===t.slug)))

// Adversarial checks must truly reject damaged data.
const badKey=JSON.parse(JSON.stringify(questions))
badKey[0].correct_option_id='z'
assert.throws(()=>check(manifest,topics,badKey),/valid answer/)
const tampered=JSON.parse(JSON.stringify(manifest))
tampered.case_transactions[0].amount=100000
assert.throws(()=>check(tampered,topics,questions))
const drift=JSON.parse(JSON.stringify(manifest))
drift.coverage=['2.1','2.2']
assert.throws(()=>check(drift,topics,questions))
const invented=JSON.parse(JSON.stringify(manifest))
invented.case_transactions.push({id:10,debit:'receivables',credit:'revenue',amount:9000})
assert.throws(()=>check(invented,topics,questions),/nine real journal entries/)

console.log('PASS: KASNEB CA11 Section 2.1-2.5, 5 original lessons, 30 questions, ledger/TB/statements, immutable SQL packet, four negative controls and narrow publication gates')
