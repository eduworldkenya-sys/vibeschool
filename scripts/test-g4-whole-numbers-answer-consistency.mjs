// Deterministic AI-independent arithmetic consistency gate for the authored Grade 4 Whole Numbers pilot.
// This checks source JSON, NOT production v3, provenance, rights, teacher-guide approval,
// independent pedagogical review, a signed publisher, or student-visible publication.
// It must never print the protected assessment marking material.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sourcePath = 'content/curriculum/production/grade4-mathematics-whole-numbers-1.1.v2.editorial.json';
const manuscript = JSON.parse(readFileSync(sourcePath, 'utf8'));
const nums = (value) => (String(value).match(/\d[\d,]*/g) || []).map(x => Number(x.replaceAll(',', '')));
const normal = (value) => String(value).toLowerCase().replace(/[-,;]+/g, ' ').replace(/\s+/g, ' ').trim();
const listEquals = (actual, expected) => assert.deepEqual(nums(actual), expected);
const factors = n => Array.from({length:n},(_,i)=>i+1).filter(x=>n%x===0);
const round10 = n => Math.floor((n + 5)/10)*10;
const placeNames = ['ones','tens','hundreds','thousands','ten thousands'];
const place = (n, digit) => {
  const s=String(n), at=s.indexOf(String(digit));
  assert(at>=0 && at===s.lastIndexOf(String(digit)), 'digit must occur once');
  const exp=s.length-at-1;
  return {name:placeNames[exp],value:Number(digit)*10**exp};
};
const units = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function numberWords(n) {
  assert(n>=0 && n<=1000, 'word number range');
  if(n===1000) return 'one thousand';
  if(n>=100) return units[Math.floor(n/100)]+' hundred'+(n%100?' and '+numberWords(n%100):'');
  if(n>=20) return tens[Math.floor(n/10)]+(n%10?'-'+units[n%10]:'');
  return units[n];
}
const roman = n => { assert(n>=1 && n<=10); return ['','I','II','III','IV','V','VI','VII','VIII','IX','X'][n]; };
const records = (a,key) => {
  assert(Array.isArray(a));
  const m=new Map(a.map(x=>[x[key],x]));
  assert.equal(m.size,a.length,'duplicate IDs in '+key);
  return m;
};
function audit(d) {
  assert.equal(d.grade,'Grade 4');
  assert.equal(d.subject,'Mathematics');
  assert.equal(d.unit,'1.1');
  assert.equal(d.practice.length,12);
  assert.equal(d.practiceFeedback.length,12);
  assert.equal(d.assessment.length,11);
  assert.equal(d.assessmentMarkingGuide.length,11);
  assert.equal(d.assessment.reduce((sum,x)=>sum+x.marks,0),16);
  const p=records(d.practice,'id'),f=records(d.practiceFeedback,'itemId');
  const a=records(d.assessment,'id'),m=records(d.assessmentMarkingGuide,'itemId');
  assert.deepEqual([...p.keys()].sort(),[...f.keys()].sort());
  assert.deepEqual([...a.keys()].sort(),[...m.keys()].sort());
  const outcomes='abcdefghijk'.split('').map(c=>'G4-MATH-1.1-'+c).sort();
  assert.deepEqual([...new Set(d.assessment.map(x=>x.outcomeCode))].sort(),outcomes);
  for(const x of d.practice) {
    assert(!('answer' in x) && !('correct_answer' in x),'practice key embedded in question');
    assert(x.prompt && x.outcomeCode && f.get(x.id).explanation);
  }
  for(const x of d.assessment) {
    assert(!('answer' in x) && !('correct_answer' in x) && !('markingGuide' in x),'assessment key exposed');
    assert(x.prompt && x.outcomeCode && m.get(x.id).rubric);
  }
  const prompt=(id)=>{const q=(p.get(id)||a.get(id));assert(q,'missing '+id);return q.prompt;};
  const ans=(id)=>(f.get(id)||m.get(id)).answer;
  const checked=(id,expected)=>assert.equal(normal(ans(id)),normal(expected),id+' answer inconsistent');

  let x=prompt('WN-P01').match(/In ([\d,]+), what is the place of (\d)/i);
  assert(x); checked('WN-P01',place(nums(x[1])[0],Number(x[2])).name);
  x=prompt('WN-P02').match(/total value of (\d) in ([\d,]+)/i);
  assert(x);listEquals(ans('WN-P02'),[place(nums(x[2])[0],Number(x[1])).value]);
  x=prompt('A01').match(/place value and total value of (\d) in ([\d,]+)/i);
  assert(x);const val=place(nums(x[2])[0],Number(x[1]));
  assert(normal(ans('A01')).includes(normal(val.name)),'A01 place');
  listEquals(ans('A01'),[val.value]);
  
  const numeral=(id)=>{
    const z=prompt(id).match(/Write (\d+) thousands?, (\d+) hundreds?, (no|\d+) tens? and (\d+) ones?/i);
    assert(z,'not a numeral composition '+id);
    return Number(z[1])*1000+Number(z[2])*100+Number(z[3]==='no'?0:z[3])*10+Number(z[4]);
  };
  listEquals(ans('WN-P03'),[numeral('WN-P03')]);
  listEquals(ans('A02'),[numeral('A02')]);
  for(const id of ['WN-P04','A03']) {
    const z=prompt(id).match(/Write (\d+) in words/i);
    assert(z);checked(id,numberWords(Number(z[1])));
  }
  for(const id of ['WN-P05','A04']) {
    const z=prompt(id).match(/Arrange (.+) in (ascending|descending) order/i);
    assert(z);
    const values=nums(z[1]).sort((l,r)=>z[2]==='ascending'?l-r:r-l);
    listEquals(ans(id),values);
  }
  for(const id of ['WN-P06','A05']) {
    const z=prompt(id).match(/Round ([\d,]+) to the nearest ten/i);
    assert(z);listEquals(ans(id),[round10(nums(z[1])[0])]);
  }
  const est=prompt('WN-P12').match(/has ([\d,]+) exercise books/i);
  assert(est);listEquals(ans('WN-P12'),[round10(nums(est[1])[0])]);
  for(const id of ['WN-P07','A06']) {
    const z=prompt(id).match(/factors of (\d+)/i);
    assert(z);listEquals(ans(id),factors(Number(z[1])));
  }
  x=prompt('WN-P08').match(/multiples of (\d+) up to (\d+)/i);
  assert(x);listEquals(ans('WN-P08'),Array.from({length:Math.floor(Number(x[2])/Number(x[1]))},(_,i)=>Number(x[1])*(i+1)));
  x=prompt('A07').match(/first four positive multiples of (\d+)/i);
  assert(x);listEquals(ans('A07'),[1,2,3,4].map(n=>n*Number(x[1])));
  x=prompt('WN-P09').match(/odd: (.+)\?/i);
  assert(x);listEquals(ans('WN-P09'),nums(x[1]).filter(n=>n%2!==0));
  x=prompt('A08').match(/odd numbers in (.+)\./i);
  assert(x);listEquals(ans('A08'),nums(x[1]).filter(n=>n%2!==0));
  x=prompt('WN-P10').match(/Continue ([\d, ]+), __/i);
  assert(x);let seq=nums(x[1]);assert.equal(seq.length,3);
  assert.equal(seq[1]-seq[0],seq[2]-seq[1],'P10 rule');
  const diff=seq[2]-seq[1];
  listEquals(ans('WN-P10'),[seq[2]+diff,seq[2]+2*diff]);
  x=prompt('A09').match(/Extend ([\d, ]+) by two terms/i);
  assert(x);seq=nums(x[1]);assert.equal(seq.length,3);
  assert.equal(seq[1]-seq[0],seq[2]-seq[1],'A09 rule');
  const step=seq[2]-seq[1],got=nums(ans('A09'));
  assert.deepEqual(got.slice(0,2),[seq[2]+step,seq[2]+step*2],'A09 sequence');
  assert.match(normal(ans('A09')),new RegExp((step>=0?'add ':'subtract ')+Math.abs(step)+'\\b'));
  for(const id of ['WN-P11','A10']) {
    const z=prompt(id).match(/(?:Write |for )(\d+)(?: using Roman numerals)?/i);
    assert(z);checked(id,roman(Number(z[1])));
  }
  const open=prompt('A11');
  assert(/exact count/i.test(open)&&/estimate/i.test(open),'open response not aligned');
  assert(/exact/i.test(ans('A11'))&&/round|approximat|estimat/i.test(ans('A11')),'open response exemplar incomplete');
  // A11 remains judgement-based and requires a genuinely separate critic before certification.
  return {practice_checked:12,assessment_keys_checked:10,open_response_semantic_review_pending:1,marks:16};
}
test('grade4 Whole Numbers arithmetic answer consistency (authoring source only)',()=>{
  assert.deepEqual(audit(manuscript),{practice_checked:12,assessment_keys_checked:10,open_response_semantic_review_pending:1,marks:16});
});
test('arithmetic gate rejects a wrong practice or assessment key',()=>{
  const bad=structuredClone(manuscript);bad.practiceFeedback[1].answer='300';
  assert.throws(()=>audit(bad));
  const bad2=structuredClone(manuscript);bad2.assessmentMarkingGuide[4].answer='990';
  assert.throws(()=>audit(bad2));
});
test('arithmetic gate rejects missing feedback or protected-key exposure',()=>{
  const bad=structuredClone(manuscript);bad.practiceFeedback.pop();
  assert.throws(()=>audit(bad));
  const bad2=structuredClone(manuscript);bad2.assessment[0].answer='exposed';
  assert.throws(()=>audit(bad2),/assessment key exposed/);
});
