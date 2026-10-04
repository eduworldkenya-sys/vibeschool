import fs from 'node:fs'
import assert from 'node:assert/strict'
import Module from 'node:module'
import ts from 'typescript'

// Boundary fixtures exercise the actual service. SQL authorization is tested separately.
const tables={student_classes:[],students:[],exams:[],exam_results:[],lesson_plans:[],homework:[],scheme_of_work:[]}
class Query {
  constructor(table){this.table=table;this.filters=[];this.from=0;this.to=Infinity;this.one=false}
  select(){return this} order(){return this}
  eq(key,value){this.filters.push(row=>row[key]===value);return this}
  in(key,values){this.filters.push(row=>values.includes(row[key]));return this}
  is(key,value){this.filters.push(row=>(row[key]??null)===value);return this}
  range(from,to){this.from=from;this.to=to;return this}
  maybeSingle(){this.one=true;return this}
  then(resolve,reject){const rows=tables[this.table].filter(row=>this.filters.every(f=>f(row))).slice(this.from,this.to+1);return Promise.resolve({data:this.one?rows[0]??null:rows,error:null}).then(resolve,reject)}
}
const client={from:table=>new Query(table),auth:{getUser:async()=>({data:{user:{id:'teacher'}},error:null})}}
const assignment={class_id:'class',class_name:'Grade 6',stream:'Yellow',subject_id:'math',subject_name:'Mathematics'}
let activeSchool='school',saved=0
const session={userId:'teacher',role:'teacher',scopeId:'school',schoolId:'school',classIds:['class'],studentIds:[],assignments:[assignment]}
const cache=new Map()
function load(file){
  if(cache.has(file))return cache.get(file)
  const m=new Module(file)
  m.require=name=>{
    if(name==='@/lib/supabase'||name==='@/lib/hq/supabase')return{ supabase:client,hqSupabase:client }
    if(name==='@/lib/hq/search')return{searchHQ:async()=>[]}
    if(name==='@/lib/learner-intelligence/progress-query')return{parseProgressQuery:input=>input==='show learners improving'?{}:null,resolveTeacherProgressQuery:async(_input,classId)=>({text:`Progress for ${classId}`,actionUrl:'/teacher/progress',actionLabel:'Open progress'})}
    if(name==='./core')return{getTwinAuthorityContext:async()=>({userId:'teacher'}),requireTwinRole:()=>[],selectTwinRoleBinding:()=>({scopeId:activeSchool,schoolId:activeSchool})}
    if(name==='./transport')return{twinRecord:v=>v??{},twinRpc:async(_role,name)=>name==='teacher_get_operating_context'?{school_id:activeSchool,classes:[assignment]}:{settings:{enabled:true},observations:[]}}
    if(name==='@/lib/teacher/examResultAuthority')return{
      saveCanonicalExamResult:async()=>{saved++;return{id:'result'}},
      getCanonicalExamSubjectPolicy:async()=>({exam_id:'exam',school_id:activeSchool,subject_id:'math',pass_mark:50,max_marks:100,pass_percentage:50,configured:true,is_locked:false})
    }
    if(name==='@/lib/assessment/exam-results')return{
      normalizeExamResultState:(value,isAbsent=false)=>isAbsent?'absent':(value||'entered'),
      examResultStateLabel:value=>String(value).replaceAll('_',' ')
    }
    if(name==='@/lib/teacher/twin')return{getTeacherTwinState:async()=>({decision:{}})}
    if(name==='./personal')return load('lib/twin/personal.ts')
    if(name==='./registry')return load('lib/twin/registry.ts')
    return Module.createRequire(import.meta.url)(name)
  }
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file)
  cache.set(file,m.exports);return m.exports
}
const {searchPersonalTwin,prepareTwinMark,confirmPersonalTwinMark,executePersonalTwin,twinPages}=load('lib/twin/service.ts')
for(let i=0;i<1201;i++){
  tables.students.push({id:`learner-${i}`,name:i===1200?'Charles Mwangi':`Learner ${i}`,deleted_at:null})
  tables.student_classes.push({id:`enrol-${i}`,student_id:`learner-${i}`,class_id:'class',school_id:'school',is_current:true})
}
for(let i=0;i<151;i++)tables.lesson_plans.push({id:`lesson-${i}`,school_id:'school',teacher_id:'teacher',class_id:'class',title:i===150?'Advanced Fractions':'Lesson',topic:'Fractions',status:'draft'})
tables.homework.push({id:'work',school_id:'school',teacher_id:'teacher',class_id:'class',title:'Fractions practice',subject:'Mathematics'})
tables.exams.push({id:'exam',school_id:'school',name:'CAT 1',exam_type:'formative',is_locked:false,term:3,academic_year:2026})
assert.ok((await searchPersonalTwin(session,'Charles Mwangi')).links.some(l=>l.id==='learner-1200'),'search must find learner past the former 500 limit')
assert.ok((await searchPersonalTwin(session,'Advanced Fractions')).links.some(l=>l.id==='lesson-150'),'search must find older lessons past the former 100 limit')
assert.equal((await searchPersonalTwin(session,'Fractions practice')).links.find(l=>l.id==='work').route,'/teacher/classhub/class/homework/work')
await assert.rejects(()=>searchPersonalTwin(session,'Charles','foreign-class'),/outside your current school role/)
for(const [query,route] of [['open classes','/teacher/classhub'],['open exam marks','/teacher/results']])assert.ok((await executePersonalTwin(query,'teacher','/teacher/pulse')).links.some(l=>l.route===route),query)
const intent={kind:'mark',student:'Charles Mwangi',subject:'maths',exam:'cat',score:40}
const prepared=await prepareTwinMark({...session,assignments:[assignment,{...assignment,class_id:'second-class'}]},intent)
assert.ok(prepared.proposal,'one learner target must resolve even when teacher teaches several classes')
assert.equal(saved,0,'preparation must never save')
tables.student_classes.push({id:'ambiguous',student_id:'learner-1200',class_id:'second-class',school_id:'school',is_current:true})
assert.equal((await prepareTwinMark({...session,assignments:[assignment,{...assignment,class_id:'second-class'}]},intent)).proposal,undefined)
tables.student_classes.pop()
tables.exams.push({...tables.exams[0],id:'other-exam'})
assert.equal((await prepareTwinMark(session,intent)).proposal,undefined,'ambiguous exams must fail closed')
tables.exams.pop()
tables.exam_results.push({exam_id:'exam',subject_id:'math',student_id:'learner-1200',teacher_id:'other',marks:25,updated_at:'now'})
assert.equal((await prepareTwinMark(session,intent)).proposal,undefined,'another teacher result must not be staged for overwrite')
tables.exam_results=[]
await assert.rejects(()=>confirmPersonalTwinMark({...prepared.proposal,createdAt:Date.now()-301000}),/expired/)
activeSchool='changed-school'
await assert.rejects(()=>confirmPersonalTwinMark(prepared.proposal),/identity or school changed/)
assert.equal(saved,0)
await assert.rejects(()=>twinPages(async()=>({data:Array(500).fill({}),error:null})),/Too many records/)
console.log('Personal Twin service: full pagination, navigation precedence, real deep links, class/subject/learner/exam ambiguity, ownership, expiry and school-change denials passed.')

const progressReply=await executePersonalTwin('show learners improving','teacher','/teacher/progress?classId=class')
assert.equal(progressReply.text,'Progress for class')
assert.equal(progressReply.links[0].route,'/teacher/progress')
