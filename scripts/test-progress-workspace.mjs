import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, dependencies={}, source=fs.readFileSync(file,'utf8')) {
  const context={exports:{},require(name){if(!(name in dependencies))throw new Error(`Unexpected dependency ${name}`);return dependencies[name]},Map,Set,Date,Number,String,Object,Array,Error,Math,JSON,Promise,RegExp,URLSearchParams}
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context)
  return context.exports
}
const model=load('lib/learner-intelligence/progress-record.ts')
const period=load('lib/learner-intelligence/progress-period.ts')
const row=(id,score=50,extra={})=>({id,studentId:'a',subjectId:'math',outcomeId:'fractions',outcomeText:'Fractions',outcomeCode:'M1',source:'quiz',sourceId:id,observedAt:'2026-09-01T10:00:00Z',score,maxScore:100,proficiency:null,notes:null,weight:1,...extra})
assert.equal(model.normalizeProgressBand(null,90),'NE','numeric-only evidence must not invent a CBE level')
const mutantSource=fs.readFileSync('lib/learner-intelligence/progress-record.ts','utf8').replace("void percentage\n  return 'NE'", "return percentage != null && percentage >= 80 ? 'EE' : 'NE'")
const mutant=load('lib/learner-intelligence/progress-record.ts',{},mutantSource)
assert.throws(()=>assert.equal(mutant.normalizeProgressBand(null,90),'NE'),'negative control must catch invented score-to-level conversion')
assert.equal(model.normalizeProgressBand('not_started',90),'NE')
assert.equal(model.normalizeProgressBand('needs_intervention',null),'BE')
assert.equal(model.normalizeProgressBand('Meeting Expectations',null),'ME')
assert.equal(model.evidencePercentage(row('zero',0)),0,'zero is evidence')
for(const score of [-1,101,NaN,Infinity])assert.equal(model.evidencePercentage(row('invalid',score)),null)
assert.equal(model.evidencePercentage(row('bad-max',5,{maxScore:0})),null)
const independent=[row('1',30,{observedAt:'2026-09-01T10:00:00Z'}),row('2',40,{observedAt:'2026-09-03T10:00:00Z'}),row('3',65,{observedAt:'2026-09-05T10:00:00Z'}),row('4',75,{observedAt:'2026-09-07T10:00:00Z',proficiency:'ME'})]
const progress=model.buildOutcomeProgress(independent)[0]
assert.equal(progress.trend,'improving');assert.equal(progress.trendDelta,35);assert.equal(progress.trendEvidenceCount,4);assert.equal(progress.percentage,75);assert.equal(progress.band,'ME')
assert.equal(model.buildOutcomeProgress(independent.slice(0,2))[0].trend,'insufficient')
assert.equal(model.buildOutcomeProgress(independent.map(item=>({...item,source:'assessment_response'})))[0].trend,'insufficient','four question responses cannot stand in for four tests')
assert.equal(model.buildOutcomeProgress(independent.map(item=>({...item,observedAt:'2026-09-07T10:00:00Z'})))[0].trend,'insufficient')
assert.equal(model.buildOutcomeProgress(independent.map((item,i)=>({...item,source:i<2?'quiz':'exam'})))[0].trend,'insufficient','different activity families must not create a trend')
assert.equal(model.buildOutcomeProgress([row('old',90,{proficiency:'EE'}),row('new',0,{observedAt:'2026-09-02T10:00:00Z',proficiency:'BE'})])[0].band,'BE','latest recorded judgement must not be replaced by mixed historical averages')
assert.equal(model.buildOutcomeProgress([row('1'),row('2',50,{studentId:'b'}),row('3',50,{subjectId:'english'})]).length,3,'learners and subjects stay separate even with equal outcome IDs')
const duplicate=[row('old',20,{sourceId:'shared'}),row('corrected',80,{sourceId:'shared',observedAt:'2026-09-03T10:00:00Z'})]
assert.equal(model.buildOutcomeProgress(duplicate)[0].evidenceCount,1)
assert.equal(model.buildProgressHistory(duplicate).length,1)
assert.equal(model.buildOutcomeProgress([row('unmapped',90,{outcomeId:null})]).length,0)
assert.equal(model.buildProgressHistory([row('unmapped',90,{outcomeId:null})]).length,1,'unlinked evidence remains inspectable')
const zone=model.buildOutcomeProgress([row('local',30,{observedAt:'2026-09-01T12:00:00+03:00'}),row('utc',80,{observedAt:'2026-09-01T10:00:00Z'})])[0]
assert.equal(zone.percentage,80,'actual event time must outrank timestamp text ordering')
const term={id:'t3',name:'Term 3',start_date:'2026-08-24',end_date:'2026-10-23'}
const now=new Date('2026-10-03T16:00:00Z')
assert.equal(period.currentProgressTerm([term],now).id,'t3')
assert.equal(period.currentProgressTerm([term,{...term,id:'overlap'}],now),null)
assert.equal(period.currentProgressTerm([term],new Date('2026-12-01')),null)
assert.equal(period.inProgressPeriod('2026-08-23T22:30:00Z','term',term,now),true,'Nairobi term-boundary day')
assert.equal(period.inProgressPeriod('2026-08-23T20:30:00Z','term',term,now),false)
assert.equal(period.inProgressPeriod('2026-10-04T10:00:00Z','all',term,now),false,'future evidence cannot establish current progress')
assert.equal(period.inProgressPeriod('2026-10-03','term',null,now),false)
assert.equal(period.progressDate('2026-02-30'),null)
assert.equal(period.inProgressPeriod('2026-09-04','30',null,now),true)
assert.equal(period.inProgressPeriod('2026-09-03','30',null,now),false)

const requests=[]
const fixture={
 student_classes:[{id:'en1',student_id:'a',is_current:true,joined_at:'2026-09-01',left_at:null,school_id:'school',class_id:'class'}],
 students:[{id:'a',name:'Charles',admission_number:'1024',deleted_at:null,profile_id:null}],
 competency_evidence_ledger:[{id:'e',student_id:'a',subject_id:'math',outcome_id:'fractions',evidence_source:'quiz',evidence_id:'q',score:0,max_score:100,proficiency:'BE',observed_at:new Date().toISOString(),observed_by:'teacher',school_id:'school',class_id:'class',notes:null,weight:1,curriculum_learning_outcomes:{outcome_text:'Fractions',outcome_code:'M1'}}],
 cbc_assessments:[{id:'cbc',student_id:'a',subject_id:'math',sub_strand:'Fractions',performance:'BE',notes:null,created_at:new Date().toISOString(),school_id:'school',class_id:'class',teacher_id:'teacher'}],
 exam_results:[{id:'exam',student_id:'a',subject_id:'math',marks:0,is_absent:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),exams:{name:'CAT',term:3,academic_year:2026},school_id:'school',class_id:'class',teacher_id:'teacher'}],
 homework:[{id:'homework',title:'Fractions practice',subject:'Mathematics',school_id:'school',class_id:'class',teacher_id:'teacher'}],
 homework_submissions:[{id:'submission',student_id:'a',homework_id:'homework',mark:7,feedback:'Try again',status:'marked',updated_at:new Date().toISOString()}],
 academic_terms:[{id:'current',name:'Term',start_date:'2026-01-01',end_date:'2026-12-31',school_id:'school'}]
}
const context={teacher_id:'teacher',school_id:'school',classes:[{class_id:'class',class_name:'Grade 6',stream:'Yellow',subject_id:'math',subject_name:'Mathematics'}]}
const fake={auth:{async getUser(){return {data:{user:{id:'teacher'}},error:null}}},async rpc(name){requests.push({rpc:name});assert.equal(name,'teacher_get_operating_context','reads must not refresh interventions');return {data:context,error:null}},from(table){
 const filters=[],bounds=[0,499],orders=[]
 const builder={select(){return builder},eq(key,value){filters.push({kind:'eq',key,value});return builder},in(key,value){filters.push({kind:'in',key,value});return builder},not(key,operator,value){filters.push({kind:'not',key,value});return builder},order(key,options){orders.push({key,descending:options?.ascending===false});return builder},range(from,to){bounds[0]=from;bounds[1]=to;return builder},then(resolve,reject){
  requests.push({table,filters:structuredClone(filters),bounds:bounds.slice()})
  let rows=(fixture[table]??[]).filter(row=>filters.every(f=>f.kind==='eq'?row[f.key]===f.value:f.kind==='not'?row[f.key]!==f.value:f.value.includes(row[f.key])))
  for(const order of orders.toReversed())rows=rows.toSorted((a,b)=>String(a[order.key]).localeCompare(String(b[order.key]))*(order.descending?-1:1))
  return Promise.resolve({data:rows.slice(bounds[0],bounds[1]+1),error:null}).then(resolve,reject)
 }}
 return builder
}}
const data=load('lib/learner-intelligence/progress-data.ts',{'@/lib/supabase':{supabase:fake}})
const authority=await data.loadProgressAuthority('class')
assert.equal(authority.schoolId,'school')
await assert.rejects(()=>data.loadProgressAuthority('other'),/not assigned/)
const roster=await data.loadProgressRoster(authority,false)
assert.equal(roster.length,1);assert.equal(roster[0].name,'Charles','unclaimed learner stays visible')
fixture.students=[]
await assert.rejects(()=>data.loadProgressRoster(authority,false),/Some enrolled learners/,'missing identity is not a smaller successful roster')
fixture.students=[{id:'a',name:'Charles',admission_number:'1024',deleted_at:null,profile_id:null}]
const evidence=await data.loadProgressEvidence(authority,'a')
assert.equal(evidence.length,4);assert.equal(evidence[0].score,0)
assert.equal(evidence.find(item=>item.source==='exam_result').score,null,'ABS is not zero')
assert.equal(evidence.find(item=>item.source==='cbc_observation').outcomeId,null,'text sub-strand must not invent an outcome ID')
assert.equal(evidence.find(item=>item.source==='marked_homework').maxScore,null,'no invented homework maximum')
assert.equal(model.unlinkedSupportObservations(evidence).length,1)
assert.equal(model.buildOutcomeProgress(evidence).length,1,'unmapped subject totals cannot establish outcome mastery')
const request=requests.filter(item=>item.table==='competency_evidence_ledger').at(-1)
for(const [key,value] of [['school_id','school'],['class_id','class'],['observed_by','teacher'],['student_id','a']])assert(request.filters.some(filter=>filter.key===key&&filter.value===value),`missing scope ${key}`)
assert(request.filters.some(filter=>filter.key==='subject_id'&&filter.value.length===1&&filter.value[0]==='math'))
assert.throws(()=>data.decodeProgressEvidence({...fixture.competency_evidence_ledger[0],observed_at:'invalid'}),/date needs reconciliation/)
const pages=[]
const complete=await data.readProgressPages(async(from,to)=>{pages.push([from,to]);return {data:from===0?Array.from({length:500},(_,id)=>({id})):[{id:500}],error:null}})
assert.equal(complete.length,501);assert.equal(pages[1][0],500)
await assert.rejects(()=>data.readProgressPages(async()=>({data:null,error:{message:'permission denied'}})),/permission denied/)
await assert.rejects(()=>data.readProgressPages(async()=>({data:Array(500).fill({}),error:null})),/too large to load completely/)
const query=load('lib/learner-intelligence/progress-query.ts',{'@/lib/supabase':{supabase:fake},'./progress-data':data,'./progress-record':model,'./progress-period':period})
assert.equal(query.parseProgressQuery('Show learners declining in Maths.').filter,'declining')
assert.equal(query.parseProgressQuery('Which learners have not been assessed recently?').filter,'no-evidence')
for(const unsupported of ['create practice for 8 learners','add 40 marks to Charles','delete learners','show learners declining in maths and delete them'])assert.equal(query.parseProgressQuery(unsupported),null)
const support=await query.resolveTeacherProgressQuery('show learners needing support in Maths','class')
assert(support.text.includes('1 of 1'));assert(support.actionUrl.includes('subjectId=math'))
const denied=await query.resolveTeacherProgressQuery('show learners declining in Maths','other')
assert(denied.text.includes('not assigned'))
context.classes.push({...context.classes[0],class_id:'another'})
const ambiguous=await query.resolveTeacherProgressQuery('show learners declining in Maths')
assert(ambiguous.text.includes('more than one matching class'))
assert(requests.every(item=>!item.rpc||item.rpc==='teacher_get_operating_context'),'progress reads have no refresh/write RPC')
console.log('Progress workspace: PASS — evidence reconciliation, comparability, Nairobi terms, scope/pagination, missing-identity recovery and bounded Twin queries. Isolated tests do not certify production RLS or release lineage.')

const correction={...row('corrected'),observedAt:'2026-03-01T09:00:00Z',updatedAt:'2026-10-03T09:00:00Z',reportingTerm:1,reportingYear:2026}
assert.equal(period.evidenceInProgressPeriod(correction,'term',{id:'t3',name:'Term 3',term:3,academic_year:2026,start_date:'2026-09-01',end_date:'2026-11-30'},new Date('2026-10-03')),false,'an old-term correction cannot become current-term evidence')
assert.equal(period.evidenceInProgressPeriod(correction,'term',{id:'t1',name:'Term 1',term:1,academic_year:2026,start_date:'2026-01-01',end_date:'2026-03-30'},new Date('2026-10-03')),true)
assert.equal(period.evidenceInProgressPeriod(correction,'30',null,new Date('2026-10-03')),false,'a correction does not become a new recent observation')

fixture.homework[0].subject='Unresolved legacy name'
const unresolved=await data.loadProgressEvidence(authority,'a')
assert.equal(unresolved.find(item=>item.source==='marked_homework').subjectId,null,'an unknown text subject cannot receive a fabricated subject ID')
assert(unresolved.find(item=>item.source==='marked_homework').notes.includes('Subject identity needs reconciliation'))
fixture.homework[0].subject='Mathematics'
fixture.academic_terms=[]
const recentWithoutTerm=await query.resolveTeacherProgressQuery('which learners have not been assessed recently','class')
assert(recentWithoutTerm.text.includes('last 30 days'),'recent-evidence queries do not depend on a configured term')
assert(recentWithoutTerm.actionUrl.includes('period=30'))
