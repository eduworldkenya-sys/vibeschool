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
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true,confirm:()=>true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
const React=await import('react'),{createRoot}=await import('react-dom/client'),{fireEvent,screen,waitFor}=await import(pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`))
const {act}=React
let failure='',isList=false,notificationWrites=0,savedSubmission=null,fixtureWrites=0,lastProjectWrite=null
const learner={id:'learner',name:'Transferred learner',admission_number:'001',profile_id:null}
globalThis.__taskFixture={
 authority:async id=>{if(failure==='authority')throw new Error('Class access denied');return {teacherId:'teacher',schoolId:'school',classId:id,className:'Grade 4',subjects:[{id:'math',name:'Maths'}]}},
 roster:async()=>{if(failure==='roster')throw new Error('Roster identity unavailable');return [learner]},
 supabase:{auth:{getUser:async()=>({data:{user:{id:'teacher'}}})},from(table){let columns='',filters=[],write=null,single=false;const q={select(value){columns=value;return q},eq(k,v){filters.push([k,v]);return q},in(k,v){filters.push([k,v]);return q},order(){return q},single(){single=true;return q},insert(value){write=value;if(table==='notifications')notificationWrites++;else assert(['projects','exercises','project_submissions','exercise_submissions'].includes(table));return q},delete(){assert(['projects','exercises','project_submissions'].includes(table));write={deleted:true};return q},update(value){assert(['project_submissions','exercise_submissions'].includes(table));write=value;return q},then(resolve,reject){
 let data=[]
 if(write&&table!=='notifications'){
 fixtureWrites++
 if(failure==='network-save')return Promise.reject(new Error('Network unavailable')).then(resolve,reject)
 if(table==='projects'||table==='exercises')lastProjectWrite=write
 if(failure==='save'||failure==='empty-save')return Promise.resolve({data:failure==='empty-save'?null:null,error:failure==='save'?{message:'Save denied'}:null}).then(resolve,reject)
 if(table==='projects'||table==='exercises')return Promise.resolve({data:{id:'new-project'},error:null}).then(resolve,reject)
 const values=Array.isArray(write)?write[0]:write
 savedSubmission={id:'submission',student_id:'learner',mark:null,feedback:null,notes:null,photo_url:null,...savedSubmission,...values}
 return Promise.resolve({data:single?savedSubmission:[savedSubmission],error:null}).then(resolve,reject)
 }
 if(table==='students'){assert(filters.some(([k,v])=>k==='id'&&Array.isArray(v)&&v.includes('learner')));assert(!filters.some(([k])=>k==='class_id'));data=[learner]}
 else if(table==='classes'){data={name:'Grade 4',stream:null,school_id:'school'}}
 else if(table==='projects'||table==='exercises'){
 assert(filters.some(([k,v])=>k==='school_id'&&v==='school'));assert(filters.some(([k,v])=>k==='class_id'&&v==='class'))
 const row={id:'task',title:'Investigation',description:null,instructions:'Read the complete exercise instructions',due_date:null,start_date:null,status:'active',created_at:'2026-10-09',subject_id:'math',project_submissions:[],exercise_submissions:[{id:'a',student_id:'learner',status:'marked'},{id:'b',student_id:'learner',status:'marked'},{id:'c',student_id:'former',status:'marked'},{id:'d',student_id:'learner',status:'pending'}]};data=isList?[row]:row
 }
 else {assert(['project_submissions','exercise_submissions','notifications'].includes(table),'Unexpected table '+table);data=savedSubmission?[savedSubmission]:[]}
 const error=failure==='records'&&(table==='projects'||table==='exercises')?{message:'Task access denied'}:null
 return Promise.resolve({data:error?null:data,error}).then(resolve,reject)
 }};return q}}
}
fs.mkdirSync('.cyborg',{recursive:true})
for(const [label,entry,list] of [
 ['projects','app/teacher/classhub/[id]/projects/page.tsx',true],
 ['exercises','app/teacher/classhub/[id]/exercises/page.tsx',true],
 ['project-grade','app/teacher/classhub/[id]/projects/[projId]/page.tsx',false],
 ['exercise-grade','app/teacher/classhub/[id]/exercises/[exId]/page.tsx',false],
]){
 isList=list
 const outfile=path.resolve(`.cyborg/${label}-roster-ui.cjs`)
 await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^(next\/navigation|next\/link|@\/lib\/supabase|@\/lib\/learner-intelligence\/progress-data)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='next/link'?`import React from 'react';export default function Link(props){return React.createElement('a',props,props.children)}`:a.path==='next/navigation'?`export const useParams=()=>({id:'class',projId:'task',exId:'task'});export const useRouter=()=>({push:()=>{},back:()=>{}});`:a.path.endsWith('/supabase')?`export const supabase=globalThis.__taskFixture.supabase;`:`export const loadProgressAuthority=id=>globalThis.__taskFixture.authority(id);export const loadProgressRoster=()=>globalThis.__taskFixture.roster();`}))
 b.onResolve({filter:/^@\//},a=>{const base=path.resolve(a.path.slice(2));return {path:fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx'}})
 }}]})
 const Page=createRequire(import.meta.url)(outfile).default
 let root=createRoot(document.getElementById('root'))
 for(const scenario of ['','records','roster','authority']){
 failure=scenario
 await act(async()=>root.render(React.createElement(Page)))
 const ready=()=>{assert(screen.getByText(list?'Investigation':'Transferred learner'));if(label==='exercise-grade'){assert(screen.getByText('Exercise instructions'));assert(screen.getByText('Read the complete exercise instructions'))}if(label==='exercises'){assert(screen.getByText('1/1 marked done'));assert(screen.getByText('All learners marked'));assert(screen.getByRole('link',{name:/Investigation/}).getAttribute('href').endsWith('/exercises/task'))}}
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
 if(list){
 const titleLabel=label==='projects'?'Project title':'Exercise title';const createName=label==='projects'?/Create Project/:/Create Exercise/;
 failure=''
 await act(async()=>root.render(React.createElement(Page)))
 await waitFor(()=>assert(screen.getByText('Investigation')))
 if(label==='exercises'){
 const color=window.getComputedStyle(screen.getByRole('button',{name:/Delete/})).color
 const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>{const c=value/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4})
 const luminance=channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722
 assert(1.05/(luminance+0.05)>=4.5,'Delete text must meet WCAG AA contrast on its white card')
 }
 failure='save'
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:/Delete/})))
 await waitFor(()=>assert(screen.getByRole('alert')))
 assert(screen.getByText('Investigation'))
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'+ New'})))
 await act(async()=>fireEvent.change(screen.getByRole('textbox',{name:titleLabel}),{target:{value:'Test project'}}))
 if(label==='exercises'){
 await act(async()=>fireEvent.change(screen.getByRole('combobox',{name:'Subject'}),{target:{value:'math'}}))
 await act(async()=>fireEvent.change(screen.getByRole('spinbutton',{name:'Duration in minutes'}),{target:{value:'-1'}}))
 const before=fixtureWrites
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:createName})))
 assert(screen.getByRole('alert'));assert.equal(fixtureWrites,before)
 await act(async()=>fireEvent.change(screen.getByRole('spinbutton',{name:'Duration in minutes'}),{target:{value:'15'}}))
 await act(async()=>fireEvent.change(screen.getByRole('textbox',{name:'Instructions'}),{target:{value:'Practice fractions'}}))
 }
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:createName})))
 await waitFor(()=>assert(screen.getByRole('alert')))
 assert.equal(screen.getByRole('textbox',{name:titleLabel}).value,'Test project')
 failure=''
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:createName})))
 await waitFor(()=>assert(!screen.queryByRole('textbox',{name:titleLabel})))
 assert.equal(lastProjectWrite.school_id,'school');assert.equal(lastProjectWrite.teacher_id,'teacher');assert.equal(lastProjectWrite.class_id,'class');if(label==='exercises')assert.equal(lastProjectWrite.instructions,'Subject: Maths\n\nPlanned duration: 15 minutes\n\nPractice fractions')
 }
 if(!list){
 failure='';savedSubmission=null
 await act(async()=>root.render(React.createElement(Page)))
 await waitFor(()=>assert(screen.getByRole('button',{name:/Transferred learner/})))
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:/Transferred learner/})))
 await act(async()=>fireEvent.change(screen.getByRole('textbox',{name:'Feedback'}),{target:{value:'Keep this feedback'}}))
 const saveName=label==='project-grade'?'Save Grade':'Mark Done'
 if(label==='project-grade'){
 await act(async()=>fireEvent.change(screen.getByRole('spinbutton',{name:'Mark'}),{target:{value:'-1'}}))
 const before=fixtureWrites
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:saveName})))
 assert(screen.getByRole('alert'));assert.equal(fixtureWrites,before)
 await act(async()=>fireEvent.change(screen.getByRole('spinbutton',{name:'Mark'}),{target:{value:'0'}}))
 }
 for(const denied of ['save','empty-save','network-save']){
 failure=denied
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:saveName})))
 await waitFor(()=>assert(screen.getByRole('alert')))
 assert.equal(screen.getByRole('textbox',{name:'Feedback'}).value,'Keep this feedback')
 assert(!screen.queryByText(label==='project-grade'?'✓ Grade saved':'✓ Marked done'))
 }
 failure=''
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:saveName})))
 await waitFor(()=>assert(screen.getByText(label==='project-grade'?'✓ Grade saved':'✓ Marked done')))
 assert.equal(savedSubmission.feedback,'Keep this feedback')
 if(label==='project-grade')assert.equal(savedSubmission.mark,0)
 // Existing-submission updates must also surface denial rather than retain stale success.
 failure='save'
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:label==='project-grade'?'Update Grade':'Update'})))
 await waitFor(()=>assert(screen.getByRole('alert')))
 assert(!screen.queryByText(label==='project-grade'?'✓ Grade saved':'✓ Marked done'))
 }
 await act(async()=>root.unmount());savedSubmission=null;failure=''
 if(label==='exercise-grade'){
 for(const existing of [false,true]){
 savedSubmission=existing?{id:'submission',student_id:'learner',status:'pending',feedback:null}:null
 root=createRoot(document.getElementById('root'))
 await act(async()=>root.render(React.createElement(Page)))
 await waitFor(()=>assert(screen.getByRole('button',{name:'✓ Mark All Done'})))
 failure='save'
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'✓ Mark All Done'})))
 await waitFor(()=>assert(screen.getByText(/Bulk marking could not be completed/)))
 assert(!screen.queryByText('Marked 1 student(s) as done.'))
 assert(screen.getByText('Not Yet Done'))
 failure=''
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'✓ Mark All Done'})))
 await waitFor(()=>assert(screen.getByText('Marked 1 student(s) as done.')))
 assert.equal(savedSubmission.status,'marked')
 await act(async()=>root.unmount());savedSubmission=null
 }
 }
 console.log(label+(list?': canonical roster and read recovery PASS':': read recovery, confirmed save/denial/input retention and applicable bulk recovery PASS'))
}
console.log('Actual class task UI: PASS; isolated fixtures, zero external notifications or production writes.')
