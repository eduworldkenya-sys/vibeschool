/** Actual report picker: isolated context, roster and read boundaries. No database writes. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const modules=process.env.WORKBOOK_UI_MODULES||'/tmp/workbook-ui/node_modules'
const {JSDOM}=await import(pathToFileURL(`${modules}/jsdom/lib/api.js`))
const {build}=await import(pathToFileURL(`${modules}/esbuild/lib/main.js`))
const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'http://localhost/teacher/results/report-card'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
const React=await import('react'),{createRoot}=await import('react-dom/client'),{fireEvent,screen,waitFor}=await import(pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`))
const {act}=React
let failure='',destinations=[]
const context={teacher_id:'teacher',school_id:'school',classes:[{class_id:'class',class_name:'Grade 4',stream:null},{class_id:'class',class_name:'Grade 4',stream:null}]}
globalThis.__reportFixture={
 push:url=>destinations.push(url),
 authority:async id=>{if(failure==='authority')throw new Error('Class access denied');return {teacherId:'teacher',schoolId:'school',classId:id}},
 roster:async()=>{if(failure==='roster')throw new Error('Roster unavailable');return [{id:'learner',name:'Transferred learner',admission_number:'001'}]},
 supabase:{auth:{getUser:async()=>({data:{user:{id:'teacher'}},error:null})},rpc:async name=>{assert.equal(name,'teacher_get_operating_context');return {data:failure==='identity'?{...context,teacher_id:'other'}:context,error:failure==='context'?{message:'Context unavailable'}:null}},from(table){let columns='',filters=[];const q={select(v){columns=v;return q},eq(k,v){filters.push([k,v]);return q},in(k,v){filters.push([k,v]);return q},order(){return q},then(resolve,reject){
 assert(['exam_results','exams','report_card_remarks'].includes(table),'Unexpected table '+table)
 let data=[]
 if(table==='exam_results'||table==='report_card_remarks'){
 assert(filters.some(([k,v])=>k==='class_id'&&v==='class'));assert(filters.some(([k,v])=>k==='school_id'&&v==='school'))
 data=table==='report_card_remarks'?[{student_id:'learner'}]:columns==='exam_id'?[{exam_id:'exam'}]:[{student_id:'learner',marks:80,is_absent:false}]
 }else data=[{id:'exam',name:'End term',term:3,academic_year:2026,exam_type:'endterm'}]
 const error=(failure==='exam'&&table==='exams')||(failure==='results'&&table==='exam_results')||(failure==='remarks'&&table==='report_card_remarks')?{message:'Read unavailable'}:null
 return Promise.resolve({data:error?null:data,error}).then(resolve,reject)
 }};return q}}
}
fs.mkdirSync('.cyborg',{recursive:true})
const outfile=path.resolve('.cyborg/report-picker-ui.cjs')
await build({entryPoints:['app/teacher/results/report-card/page.tsx'],outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^(next\/navigation|@\/lib\/supabase|@\/lib\/learner-intelligence\/progress-data)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='next/navigation'?`export const useRouter=()=>({push:globalThis.__reportFixture.push});export const useSearchParams=()=>new URLSearchParams();`:a.path.endsWith('/supabase')?`export const supabase=globalThis.__reportFixture.supabase;`:`export const loadProgressAuthority=id=>globalThis.__reportFixture.authority(id);export const loadProgressRoster=()=>globalThis.__reportFixture.roster();`}))
 }}]})
const Page=createRequire(import.meta.url)(outfile).default
for(const scenario of ['','context','identity','authority','exam','results','roster','remarks']){
 failure=['context','identity'].includes(scenario)?scenario:''
 const root=createRoot(document.getElementById('root'))
 await act(async()=>root.render(React.createElement(Page)))
 if(['context','identity'].includes(scenario)){
 await waitFor(()=>assert(screen.getByRole('alert')));failure=''
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Try again'})))
 }
 await waitFor(()=>assert.equal(screen.getAllByRole('button',{name:/Grade 4.*Tap to view exams/}).length,1))
 if(['authority','exam','results'].includes(scenario))failure=scenario
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:/Grade 4.*Tap to view exams/})))
 if(['authority','exam','results'].includes(scenario)){
 await waitFor(()=>assert(screen.getByRole('alert')));assert(!screen.queryByText('No exams recorded for this class yet.'));failure=''
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Try again'})))
 }
 await waitFor(()=>assert(screen.getByRole('button',{name:/End term.*2026/})))
 if(['roster','remarks'].includes(scenario))failure=scenario
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:/End term.*2026/})))
 if(['roster','remarks'].includes(scenario)){
 await waitFor(()=>assert(screen.getByRole('alert')));assert(!screen.queryByText('No students enrolled in this class.'));failure=''
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Try again'})))
 }
 await waitFor(()=>assert(screen.getByRole('button',{name:/Transferred learner/})))
 assert(screen.getByText('EE'));assert(screen.getByText('✓ Remarked'))
 await act(async()=>fireEvent.change(screen.getByRole('textbox',{name:'Search students'}),{target:{value:'001'}}))
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:/Transferred learner/})))
 assert.equal(destinations.at(-1),'/teacher/results/report-card/learner?examId=exam&mode=844')
 await act(async()=>root.unmount())
}
console.log('Actual report picker: canonical deduplicated classes, current roster, scoped reads, denied identity/context, errors/retry, search and report navigation PASS; no production writes.')
