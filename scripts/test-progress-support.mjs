/** Actual readers and export model; query fixtures do not certify production RLS. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import Module from 'node:module'
import ts from 'typescript'
const context={teacher_id:'teacher',school_id:'school',classes:[{class_id:'class',class_name:'Grade 6',subject_id:'math',subject_name:'Mathematics'}]}
let signedIn=true
const requests=[]
const fixture={assessment_interventions:[],report_cards:[]}
class Query {
  constructor(table){this.table=table;this.filters=[];this.bounds=[0,499]}
  select(){return this}order(){return this}
  eq(key,value){this.filters.push([key,value,false]);return this}
  in(key,value){this.filters.push([key,value,true]);return this}
  range(from,to){this.bounds=[from,to];return this}
  then(resolve,reject){requests.push({table:this.table,filters:this.filters,bounds:this.bounds});return Promise.resolve({data:(fixture[this.table]??[]).filter(row=>this.filters.every(([key,value,many])=>many?value.includes(row[key]):row[key]===value)).slice(this.bounds[0],this.bounds[1]+1),error:null}).then(resolve,reject)}
}
const client={auth:{getUser:async()=>({data:{user:signedIn?{id:'teacher'}:null},error:null})},from:table=>new Query(table),rpc:async(name)=>{requests.push({rpc:name});assert.equal(name,'teacher_get_operating_context','a read must never refresh the queue or mutate reports');return {data:context,error:null}}}
const cache=new Map()
function load(file,source){if(!source&&cache.has(file))return cache.get(file);const m=new Module(file);m.require=name=>{
 if(name==='@/lib/supabase')return{supabase:client}
 const aliases={'@/lib/learner-intelligence/progress-data':'lib/learner-intelligence/progress-data.ts','./progress-record':'lib/learner-intelligence/progress-record.ts','./progress-period':'lib/learner-intelligence/progress-period.ts','@/lib/class-workbook/model':'lib/class-workbook/model.ts'}
 if(aliases[name])return load(aliases[name])
 return Module.createRequire(import.meta.url)(name)
};m._compile(ts.transpileModule(source??fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);if(!source)cache.set(file,m.exports);return m.exports}
const support=load('lib/assessment/interventions.ts'),reports=load('lib/report-cards/service.ts'),review=load('lib/learner-intelligence/progress-review.ts')
const mutatingSource=fs.readFileSync('lib/assessment/interventions.ts','utf8').replace("supabase.rpc('teacher_get_operating_context')","supabase.rpc('exq_list_intervention_queue')")
const mutatingReader=load('lib/assessment/interventions.ts',mutatingSource)
await assert.rejects(()=>mutatingReader.listInterventionQueue('class'),/a read must never/,'negative control must catch reintroduced read-triggered mutation')
const item={id:'i',teacher_id:'teacher',school_id:'school',class_id:'class',subject_id:'math',student_id:'learner',outcome_id:'fractions',priority:'high',recommendation:'Try guided practice',recommendation_type:'guided_practice',mastery_score:30,evidence_count:2,confidence_score:25,repeated_weakness_count:2,evidence_snapshot:{},status:'open',due_at:'2026-10-01',updated_at:'2026-09-30',students:{name:'Charles',admission_number:'1024'},curriculum_learning_outcomes:{outcome_code:'M1',outcome_text:'Fractions'}}
for(let i=0;i<501;i++)fixture.assessment_interventions.push({...item,id:`i-${i}`})
fixture.assessment_interventions.push({...item,id:'closed',status:'completed'},{...item,id:'other-school',school_id:'other'},{...item,id:'other-subject',subject_id:'science'})
assert.equal((await support.listInterventionQueue('class')).length,501,'all pages must be loaded')
assert.equal((await support.listInterventionQueue('class',true)).length,502,'closed support can be reviewed without recreating it')
assert.equal(fixture.assessment_interventions[0].due_at,'2026-10-01','opening support must not move its due date')
await assert.rejects(()=>support.listInterventionQueue('other'),/not assigned/)
fixture.assessment_interventions[0].students=null
await assert.rejects(()=>support.listInterventionQueue('class'),/learner identity reconciliation/,'missing authorized identity must not yield a successful partial queue')
fixture.assessment_interventions[0].students=item.students
fixture.assessment_interventions[0].curriculum_learning_outcomes=null
await assert.rejects(()=>support.listInterventionQueue('class'),/curriculum outcome reconciliation/,'missing historical outcome authority must fail explicitly instead of surfacing an invalid-payload error')
fixture.assessment_interventions[0].curriculum_learning_outcomes=item.curriculum_learning_outcomes
const report={id:'report',school_id:'school',class_id:'class',student_id:'learner',term_id:'term',academic_year:2026,status:'draft',revision:1,completeness_status:'incomplete',completeness_issues:[],validation_status:'not_validated',validation_issues:[],evidence_version:1,evidence_generated_at:null,updated_at:'2026-10-03',students:{name:'Charles'},classes:{name:'Grade 6'},academic_terms:{name:'Term 3'}}
fixture.report_cards=[report,{...report,id:'other-report',school_id:'other'},{...report,id:'other-learner',student_id:'other'}]
assert.equal((await reports.listTeacherReportCards({classId:'class',studentId:'learner'})).length,1)
await assert.rejects(()=>reports.listTeacherReportCards({classId:'other'}),/not assigned/)
signedIn=false
await assert.rejects(()=>support.listInterventionQueue('class'),/Sign in/)
await assert.rejects(()=>reports.listTeacherReportCards(),/Sign in/)
signedIn=true
assert.equal((await reports.listReportCards()).length,3,'the admin reader must not require Teacher context')
const evidence={id:'e',studentId:'learner',subjectId:'math',outcomeId:null,outcomeText:'Fractions',outcomeCode:null,source:'exam_result',sourceId:'result',observedAt:'2026-10-02',score:0,maxScore:100,proficiency:null,notes:'PRIVATE OBSERVATION',weight:1}
const csv=review.progressCsv([evidence],[{id:'learner',name:'=HYPERLINK("bad")',admission_number:'0012'}],[{id:'math',name:'Mathematics'}],{className:'Grade 6',period:'Term 3',asOf:'2026-10-03'})
assert(csv.includes("'=HYPERLINK"),'formula-like names must be neutralized')
assert(csv.includes('"0","100","0","NE"'),'zero is retained and cannot fabricate an expectation level')
assert(!csv.includes('PRIVATE OBSERVATION'),'private notes never enter a working-copy export')
const checks=review.progressDataChecks([evidence,{...evidence,id:'copy'},{...evidence,id:'scale',sourceId:'scale',score:101},{...evidence,id:'maximum',sourceId:'maximum',maxScore:null},{...evidence,id:'future',sourceId:'future',observedAt:'2027-01-01'}],new Date('2026-10-03'))
assert.equal(checks.repeatedSourceRows,1);assert.equal(checks.invalidScale,1);assert.equal(checks.unknownMaximum,1);assert.equal(checks.futureDated,1)
console.log('Progress support: PASS — read-only complete queue, active-school/subject scopes, closed history, identity and sign-in failures, scoped reports, zero, formula-safe export, private-note exclusion and data checks. Production RLS is not certified by fixtures.')
