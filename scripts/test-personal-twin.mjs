import fs from 'node:fs'
import assert from 'node:assert/strict'
import Module from 'node:module'
import ts from 'typescript'

const source=fs.readFileSync('lib/twin/personal.ts','utf8')
const m=new Module('personal-twin-test')
m._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,'personal-twin-test')
const {interpretTwinCommand:parse,safeTwinRoute,matchTwinLinks,predictTwinNext}=m.exports
for(const [query,score] of [['add 40 marks to Sifuna in maths cat',40],['give Sifuna forty for maths cat',40],['record forty marks for Sifuna in maths CAT 2',40],['set 0 marks for Sifuna in maths cat',0],['add 100 marks to Sifuna in maths CAT',100],['record twenty five marks for Mary Achieng in English CAT',25]]) {
  const result=parse(query);assert.equal(result.kind,'mark',query);assert.equal(result.score,score,query)
}
for(const query of ['add 101 marks to Sifuna in maths cat','add -40 marks to Sifuna in maths cat','give everyone except Mary 10 marks','delete all students','publish results','change Sifuna score by 40','add 40 to Sifuna','set 20 20 marks for Sifuna in maths cat'])assert.equal(parse(query).kind,'unsupported',query)
assert.deepEqual(parse('pause learning'),{kind:'preference',enabled:false})
assert.deepEqual(parse('enable collective learning'),{kind:'preference',collective:true})
assert.equal(parse('open my timetable').kind,'navigate')
assert.equal(parse('find Charles Mwangi').kind,'search')
assert.equal(parse('continue where i stopped').kind,'continue')
assert.equal(parse('x'.repeat(501)).kind,'unsupported')
for(const path of ['https://evil.test','//evil.test','/hq/users','/teacher\\evil','/teacher/results\n','/teacher/../hq/users','/teacher/%2e%2e/hq/users','/teacher/%5c..%5chq/users'])assert.equal(safeTwinRoute(path,'teacher'),false)
assert.equal(safeTwinRoute('/teacher/classhub/123/student/456','teacher'),true)
const links=[{id:'1',title:'Mathematics',detail:'Results',kind:'subject',route:'/teacher/results'},{id:'2',title:'English',detail:'Literature',kind:'subject',route:'/teacher/subjecthub'}]
assert.equal(matchTwinLinks('maths',links)[0].id,'1')
assert.deepEqual(matchTwinLinks('not a matching person',links),[])
const now=new Date('2026-10-03T12:00:00Z')
const base={role:'teacher',scope_id:'school-a',route:'/teacher/results',created_at:now.toISOString()}
const records=[{...base,id:'latest',action:'assessment',previous_action:'home'},...Array.from({length:6},(_,i)=>({...base,id:String(i),action:'results',previous_action:'assessment'}))]
assert.equal(predictTwinNext(records,'teacher','school-a',now)[0].confidence,'supported')
assert.deepEqual(predictTwinNext(records,'parent','school-a',now),[])
assert.deepEqual(predictTwinNext(records,'teacher','school-b',now),[])
assert.deepEqual(predictTwinNext(records.map(r=>({...r,created_at:'2026-01-01'})),'teacher','school-a',now),[])
assert.deepEqual(predictTwinNext(records.slice(0,3),'teacher','school-a',now),[])
console.log('Personal Twin: deterministic commands, score limits, unsupported writes, role/scope boundaries, route safety, aliases and evidence thresholds passed.')
