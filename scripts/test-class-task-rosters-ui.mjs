/** Actual projects/exercise surfaces. All data and notification boundaries are isolated. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const modules=process.env.WORKBOOK_UI_MODULES||'/tmp/workbook-ui/node_modules'
const {JSDOM}=await import(pathToFileURL(`${modules}/jsdom/lib/api.js`))
const {build}=await import(pathToFileURL(`${modules}/esbuild/lib/main.js`))
const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'http://localhost/teacher/classhub/class/projects'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
const React=await import('react'),{createRoot}=await import('react-dom/client'),{fireEvent,screen,waitFor}=await import(pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`))
const {act}=React
let failure='',isList=false,notificationWrites=0
const learner={id:'learner',name:'Transferred learner',admission_number:'001',profile_id:null}
globalThis.__taskFixture={
 authority:async id=>{if(failure==='authority')throw new Error('Class access denied');return {teacherId:'teacher',schoolId:'school',classId:id,className:'Grade 4',subjects:[{id:'math',name:'Maths'}]}},
 roster:async()=>{if(failure==='roster')throw new Error('Roster identity unavailable');return [learner]},
 supabase:{auth:{getUser:async()=>({data:{user:{id:'teacher'}}})},from(table){let columns='',filters=[];const q={select(value){columns=value;return q},eq(k,v){filters.push([k,v]);return q},in(k,v){filters.push([k,v]);return q},order(){return q},single(){return q},insert(){assert.equal(table,'notifications');notificationWrites++;return q},then(resolve,reject){
 let data=[]
 if(table==='students'){assert(filters.some(([k,v])=>k==='id'&&Array.isArray(v)&&v.includes('learner')));assert(!filters.some(([k])=>k==='class_id'));data=[learner]}
 else if(table==='classes'){data={name:'Grade 4',stream:null,school_id:'school'}}
 else if(table==='projects'||table==='exercises'){
 assert(filters.some(([k,v])=>k==='school_id'&&v==='school'));assert(filters.some(([k,v])=>k==='class_id'&&v==='class'))
 const row={id:'task',title:'Investigation',description:null,instructions:null,due_date:null,start_date:null,status:'active',created_at:'2026-10-09',subject_id:'math',project_submissions:[]};data=isList?[row]:row
 }
 else assert(['project_submissions','exercise_submissions','notifications'].includes(table),'Unexpected table '+table)
 const error=failure==='records'&&(table==='projects'||table==='exercises')?{message:'Task access denied'}:null
 return Promise.resolve({data:error?null:data,error}).then(resolve,reject)
 }};return q}}
}
fs.mkdirSync('.cyborg',{recursive:true})
for(const [label,entry,list] of [
 ['projects','app/teacher/classhub/[id]/projects/page.tsx',true],
 ['project-grade','app/teacher/classhub/[id]/projects/[projId]/page.tsx',false],
 ['exercise-grade','app/teacher/classhub/[id]/exercises/[exId]/page.tsx',false],
]){
 isList=list
 const outfile=path.resolve(`.cyborg/${label}-roster-ui.cjs`)
 await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^(next\/navigation|@\/lib\/supabase|@\/lib\/learner-intelligence\/progress-data)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='next/navigation'?`export const useParams=()=>({id:'class',projId:'task',exId:'task'});export const useRouter=()=>({push:()=>{},back:()=>{}});`:a.path.endsWith('/supabase')?`export const supabase=globalThis.__taskFixture.supabase;`:`export const loadProgressAuthority=id=>globalThis.__taskFixture.authority(id);export const loadProgressRoster=()=>globalThis.__taskFixture.roster();`}))
 b.onResolve({filter:/^@\//},a=>{const base=path.resolve(a.path.slice(2));return {path:fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx'}})
 }}]})
 const Page=createRequire(import.meta.url)(outfile).default
 let root=createRoot(document.getElementById('root'))
 for(const scenario of ['','records','roster','authority']){
 failure=scenario
 await act(async()=>root.render(React.createElement(Page)))
 const ready=()=>assert(screen.getByText(list?'Investigation':'Transferred learner'))
 if(!scenario){await waitFor(ready)
 if(label==='project-grade'){
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:/Remind Non-Submitters/})))
 assert(screen.getByText('No pending learners have linked accounts for reminders.'));assert.equal(notificationWrites,0)
 }}else{
 await waitFor(()=>assert(screen.getByRole('alert')))
 assert(!screen.queryByText('No projects yet'),'Read failure must not be shown as empty success')
 failure=''
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Try again'})))
 await waitFor(ready)
 }
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root'))
 }
 await act(async()=>root.unmount())
 console.log(label+': current roster, school/class scope, authority/roster/task errors and retry PASS')
}
console.log('Actual class task UI: PASS; isolated fixtures, zero external notifications or production writes.')
