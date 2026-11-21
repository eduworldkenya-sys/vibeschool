import assert from 'node:assert/strict';
import test from 'node:test';
import './test-g4-whole-numbers-answer-consistency.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileContent,readbackSql} from './compile-content-as-code.mjs';
const m=JSON.parse(readFileSync('content/curriculum/production/grade4-mathematics-whole-numbers-1.1.content-manifest.json'));
const bytes=readFileSync(m.manuscript),doc=JSON.parse(bytes);
function edit(fn){const d=structuredClone(doc),manifest=structuredClone(m);fn(d,manifest);const b=Buffer.from(JSON.stringify(d));manifest.editorialBlob=createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');return [manifest,d,b]}
test('actual version compiles to six exact canonical payloads',()=>{
 const c=compileContent(m,doc,bytes);
 assert.equal(c.components.length,6);
 assert.equal(c.observed.marks,16);
 const a=c.components.find(x=>x.role==='assessment').payload;
 assert.ok(a.items.every(x=>!('answer' in x)));
 assert.ok(!('markingGuide' in a));
 assert.ok(!('feedback' in c.components.find(x=>x.role==='learner').payload));
 assert.deepEqual(c.components.find(x=>x.role==='marking').payload.markingGuide,doc.assessmentMarkingGuide);
 assert.match(readbackSql(c),/publication_verified',false/);
 assert.match(readbackSql(c),/vs_curriculum_package_gate/);
 assert.doesNotMatch(readbackSql(c),/\b(insert into|update public\.|delete from|alter table|publish_publication\()\b/i);
});
test('rejects wrong source blob and version',()=>{
 assert.throws(()=>compileContent({...m,editorialBlob:'wrong'},doc,bytes),/blob mismatch/);
 assert.throws(()=>compileContent({...m,version:3},doc,bytes),/version mismatch/);
});
test('rejects incomplete and unsafe component contracts',()=>{
 assert.throws(()=>compileContent(...edit(d=>{d.reader[0].sourceOutcomeCodes=['wrong']})),/coverage mismatch/);
 assert.throws(()=>compileContent(...edit(d=>{d.practiceFeedback.pop()})),/feedback coverage mismatch/);
 assert.throws(()=>compileContent(...edit(d=>{d.assessment[0].answer='leak'})),/answer material/);
 assert.throws(()=>compileContent(...edit(d=>{d.assessment[1].id=d.assessment[0].id})),/duplicate IDs/);
 assert.throws(()=>compileContent(...edit(d=>{d.visualCandidates[0].alt=''})),/alt text missing/);
 assert.throws(()=>compileContent(...edit((d,m)=>{m.components.marking=m.components.learner})),/identity mismatch/);
});
