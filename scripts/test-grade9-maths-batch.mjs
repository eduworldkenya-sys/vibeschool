import fs from 'node:fs'
import assert from 'node:assert/strict'

const batch=JSON.parse(fs.readFileSync('content/assessments/grade9-maths-100-topic-practice.batch.json','utf8'))
const papers=batch.papers
const allowed=new Set(['Integers','Cubes and Cube Roots','Indices and Logarithms','Linear Inequalities','Probability'])
assert.equal(papers.length,20)
const prompts=new Set()
const keys=new Set()
const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a)
const fraction=(a,b)=>`${a/gcd(a,b)}/${b/gcd(a,b)}`
let count=0
const answers={A:0,B:0,C:0,D:0}
for(const paper of papers) {
  assert.equal(paper.grade,'Grade 9')
  assert.equal(paper.subject,'Mathematics')
  assert.equal(paper.items.length,5)
  assert.equal(paper.total_marks,5)
  assert.ok(allowed.has(paper.items[0].topic))
  for(const [i,q] of paper.items.entries()){
    assert.equal(q.number,i+1)
    assert.equal(q.topic,paper.items[0].topic)
    assert.equal(q.options.length,4)
    assert.deepEqual(q.options.map(o=>o.value),['A','B','C','D'])
    assert.equal(new Set(q.options.map(o=>o.label)).size,4)
    assert.ok(!prompts.has(q.prompt.toLowerCase()))
    assert.ok(!keys.has(q.bank_key))
    assert.ok(q.explanation.length>12)
    prompts.add(q.prompt.toLowerCase())
    keys.add(q.bank_key)
    const nums=[...q.prompt.matchAll(/\d+/g)].map(m=>Number(m[0]))
    let expected
    if(q.topic==='Integers'){
      if(q.prompt.startsWith('Calculate −'))expected=-nums[0]+nums[1]*nums[2]
      else if(q.prompt.startsWith('A temperature'))expected=nums[0]+nums[1]
      else if(q.prompt.startsWith('Evaluate (−'))expected=-nums[0]*nums[1]+nums[2]
      else expected=nums[0]+nums[1]-nums[2]
    }else if(q.topic==='Cubes and Cube Roots'){
      if(q.prompt.startsWith('Find the cube')||q.prompt.startsWith('A cube is'))expected=nums[0]**3
      else expected=Math.round(Math.cbrt(nums[0]))
    }else if(q.topic==='Indices and Logarithms'){
      if(q.prompt.startsWith('Evaluate ')&&!q.prompt.startsWith('Evaluate ('))expected=nums[0]**(nums[1]+nums[3])
      else if(q.prompt.startsWith('Simplify'))expected=nums[0]**(nums[1]-nums[3])
      else if(q.prompt.startsWith('Evaluate ('))expected=nums[0]**(nums[1]*nums[2])
      else expected=nums[1]
    }else if(q.topic==='Linear Inequalities'){
      const match=q.prompt.replaceAll('−','-').match(/^Solve (-?\d+)x ([+-]) (\d+) ([<>≤≥]) (-?\d+)\.$/)
      assert.ok(match,'Unparseable inequality: '+q.prompt)
      const [,a,sign,b,op,c]=match
      const A=Number(a),B=Number(b)*(sign==='+'?1:-1),C=Number(c)
      const threshold=(C-B)/A
      assert.ok(Number.isInteger(threshold))
      const inverse={'<':'>','>':'<','≥':'≤','≤':'≥'}
      expected=`x ${A<0?inverse[op]:op} ${threshold}`
    }else{
      let numerator,denominator
      if(q.prompt.startsWith('A bag')){numerator=nums[0];denominator=nums[0]+nums[1]}
      else if(q.prompt.startsWith('A number')){numerator=Math.floor(nums[1]/2);denominator=nums[1]}
      else if(q.prompt.startsWith('A fair')){numerator=6-nums[0];denominator=6}
      else{numerator=nums[0];denominator=nums[0]+nums[1]}
      expected=fraction(numerator,denominator)
    }
    assert.equal(q.options.find(option=>option.value===q.correctAnswer)?.label,String(expected),q.bank_key)
    answers[q.correctAnswer]++
    count++
  }
}
assert.equal(count,100)
assert.deepEqual(answers,{A:25,B:25,C:25,D:25})
const sql=fs.readFileSync('supabase/migrations/20261110170000_grade9_original_topic_batch_publisher.sql','utf8')
assert.match(sql,/hq_publish_original_practice/)
assert.match(sql,/public.is_platform_owner/)
assert.match(sql,/explicit_owner_approval_required/)
assert.match(sql,/count\(\*\) from public.assessment_items/)
assert.match(sql,/time_limit_minutes=null/)
assert.match(sql,/topic_practice',true/)
const ui=fs.readFileSync('app/hq/exams/batch/page.tsx','utf8')
assert.match(ui,/hq_publish_original_topic_batch/)
assert.match(ui,/approved&&validatedRaw===raw/)
console.log('PASS: 100 source-authored Grade 9 MCQs; 20 sets; independent maths verification; canonical publisher invariants')
