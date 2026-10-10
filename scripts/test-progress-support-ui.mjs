/** Exercise actual support/report views across scope changes and failures. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const modules=process.env.PROGRESS_UI_MODULES||'/tmp/progress-ui/node_modules'
const outputDir=fs.mkdtempSync('/tmp/progress-support-ui-');fs.symlinkSync(path.resolve('node_modules'),path.join(outputDir,'node_modules'),'dir')
const {JSDOM}=await import(pathToFileURL(`${modules}/jsdom/lib/api.js`))
const {build}=await import(pathToFileURL(`${modules}/esbuild/lib/main.js`))
const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'http://localhost/teacher/assessment/interventions'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
const React=await import('react'),{createRoot}=await import('react-dom/client'),{fireEvent,screen,waitFor}=await import(pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`))
const {act}=React,require=createRequire(import.meta.url)
const item={interventionId:'i',studentId:'learner',studentName:'Charles',classId:'class',className:'Grade 6',subjectId:'math',subjectName:'Mathematics',outcomeId:'fractions',outcomeText:'Fractions',priority:'high',status:'completed',recommendation:'Review the released result',masteryScore:65,evidenceCount:4,confidenceScore:99,repeatedWeaknessCount:1,baselineMasteryScore:30,followupMasteryScore:65,masteryChange:35,dueAt:'2026-01-01',remedialAssignmentId:'assignment',remedialAssessmentId:'assessment'}
Object.assign(globalThis,{__supportRows:[item],__supportCalls:[],__supportError:'',__supportDelay:null,__routes:[],__search:new URLSearchParams('classId=class&subjectId=math'),__reportRows:[],__reportCalls:[]})
async function component(entry,label){const outfile=path.join(outputDir,`${label}-ui.cjs`);await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'local-css'},external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'support-boundary',setup(builder){
 builder.onResolve({filter:/^(next\/navigation|next\/link|@\/lib\/supabase|@\/lib\/assessment\/interventions|@\/lib\/report-cards\/service|@\/lib\/learner-intelligence\/progress-data)$/},args=>({path:args.path,namespace:'fixture'}))
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='next/link'?`import React from 'react';export default props=>React.createElement('a',props);`:args.path==='@/lib/supabase'?`const context={teacher_id:'teacher',school_id:'school',schools:[{id:'school',name:'School'}],classes:[{class_id:'class',class_name:'Grade 6',subject_id:'math',subject_name:'Mathematics'},{class_id:'other',class_name:'Grade 7',subject_id:'math',subject_name:'Mathematics'}]};export const supabase={auth:{getUser:async()=>({data:{user:{id:'teacher'}},error:null})},rpc:async()=>({data:context,error:null}),from:()=>{const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,range:()=>q,then:(resolve,reject)=>Promise.resolve({data:[],error:null}).then(resolve,reject)};return q}};`:args.path==='next/navigation'?`export const useSearchParams=()=>globalThis.__search;export const useRouter=()=>({push:url=>globalThis.__routes.push(url)});`:args.path.endsWith('progress-data')?`export async function readProgressPages(query){const result=await query(0,499);if(result.error)throw result.error;return result.data};export async function loadProgressAuthority(id){return {classId:id,subjects:[{id:'math',name:'Mathematics'}]}};`:args.path.endsWith('interventions')?`
 export async function listInterventionQueue(id,closed){globalThis.__supportCalls.push({id,closed});const delay=globalThis.__supportDelay;if(delay?.id===id)await delay.promise;if(globalThis.__supportError)throw new Error(globalThis.__supportError);return structuredClone(globalThis.__supportRows.filter(row=>row.classId===id&&(closed||row.status!=='completed')))}
 export async function refreshInterventionEvidence(){throw new Error('unexpected write')};export async function createInterventionAssessment(){throw new Error('unexpected write')};export async function evaluateIntervention(){throw new Error('unexpected write')};export async function updateIntervention(){throw new Error('unexpected write')};`: `
 export async function listTeacherReportCards(scope){globalThis.__reportCalls.push(scope);return structuredClone(globalThis.__reportRows.filter(row=>row.classId===scope.classId&&(!scope.studentId||row.studentId===scope.studentId)))};
 export async function listReportSubjects(){return []};
 export const generateReportCardEvidence=async()=>{throw new Error('unexpected write')};export const generateSubjectReportIntelligence=generateReportCardEvidence;export const submitReportCard=generateReportCardEvidence;export const updateSubjectReport=generateReportCardEvidence;export const validateReportCard=generateReportCardEvidence;`}))
 }}]});return require(outfile).default}
const Support=await component('app/teacher/assessment/interventions/page.tsx','support'),Reports=await component('app/teacher/report-cards/page.tsx','reports')
let root=createRoot(document.getElementById('root'))
await act(async()=>root.render(React.createElement(Support)))
await waitFor(()=>assert(screen.getByText('No support records match')))
await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Include completed support'})))
await waitFor(()=>assert(screen.getByText('Charles')))
assert(!screen.queryByRole('button',{name:'Evaluate follow-up'}),'closed support must have no evaluation/write buttons')
assert(!document.body.textContent.includes('99% confidence'),'an arbitrary formula must not appear as measured confidence')
assert.equal(globalThis.__supportCalls.at(-1).closed,true)
globalThis.__supportError='Support identity access denied'
await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Show open support'})))
await waitFor(()=>assert(screen.getByRole('alert').textContent.includes('Support identity access denied')))
assert(!screen.queryByText('No support records match'),'a failed queue is not a successful empty queue')
globalThis.__supportError=''
await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Retry'})))
await waitFor(()=>assert(screen.getByText('No support records match')))
await act(async()=>root.unmount());root=createRoot(document.getElementById('root'))
let resume;globalThis.__supportDelay={id:'class',promise:new Promise(resolve=>{resume=resolve})}
await act(async()=>root.render(React.createElement(Support)))
globalThis.__search=new URLSearchParams('classId=other&subjectId=math');globalThis.__supportRows=[{...item,classId:'other',studentName:'Mary',status:'open'}]
await act(async()=>root.render(React.createElement(Support)))
await waitFor(()=>assert(screen.getByText('Mary')))
await act(async()=>{resume();await Promise.resolve()})
assert(screen.getByText('Mary'));assert(!screen.queryByText('Charles'),'a previous scope must not overwrite the new queue')
await act(async()=>root.unmount());root=createRoot(document.getElementById('root'))
globalThis.__search=new URLSearchParams('classId=class&studentId=learner&subjectId=math')
globalThis.__reportRows=[{id:'r',studentId:'learner',studentName:'Charles',classId:'class',className:'Grade 6',termName:'Term 3',academicYear:2026,revision:1,status:'published',completenessStatus:'frozen',validationStatus:'frozen',completenessIssues:[],validationIssues:[]},{id:'other',studentId:'other',studentName:'Mary',classId:'class'}]
await act(async()=>root.render(React.createElement(Reports)))
await waitFor(()=>assert(screen.getByText('Charles')))
assert(!screen.queryByText('Mary'));assert(!screen.queryByRole('button',{name:'Generate evidence'}),'published reports are read-only')
await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Progress Record'})))
assert.equal(globalThis.__routes.at(-1),'/teacher/classhub/class/student/learner/progress?subjectId=math')
assert.deepEqual(globalThis.__reportCalls.at(-1),{classId:'class',studentId:'learner'})
await act(async()=>root.unmount())
fs.rmSync(outputDir,{recursive:true,force:true})
console.log('Progress support/report DOM: PASS — closed support remains read-only, failure is not empty success, retry and stale scope recovery, scoped report context and published-report write protection. Not production-session evidence.')
