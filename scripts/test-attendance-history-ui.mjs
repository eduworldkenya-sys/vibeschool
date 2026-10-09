/** Actual attendance-history UI and read service; isolated fixture boundaries. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const modules=process.env.WORKBOOK_UI_MODULES||'/tmp/workbook-ui/node_modules'
const {JSDOM}=await import(pathToFileURL(`${modules}/jsdom/lib/api.js`))
const {build}=await import(pathToFileURL(`${modules}/esbuild/lib/main.js`))
const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'http://localhost/teacher/classhub/class/attendance-history'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
const React=await import('react'),{createRoot}=await import('react-dom/client'),{fireEvent,screen,waitFor}=await import(pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`))
const {act}=React
let failure='',calls=[]
globalThis.__attendanceScope={id:'class'}
globalThis.__attendanceFixture={
 authority:async id=>{if(failure==='authority')throw new Error('Class access denied');return {schoolId:'school',classId:id,className:'Grade 4',subjects:[]}},
 roster:async()=>{if(failure==='roster')throw new Error('Roster identity unavailable');return [{id:'learner',name:'Transferred learner',admission_number:'001'}]},
 supabase:{from(table){assert.equal(table,'attendance');const filters=[];const q={select(){return q},gte(){return q},lte(){return q},order(){return q},eq(k,v){filters.push([k,v]);return q},then(resolve,reject){calls.push(filters);assert(filters.some(([k,v])=>k==='school_id'&&v==='school'));assert(filters.some(([k,v])=>k==='class_id'&&v==='class'));return Promise.resolve({data:failure==='records'?null:[{id:'record',student_id:'learner',class_id:'class',date:'2026-10-09',status:'present',is_late:false,notes:null}],error:failure==='records'?{message:'Attendance access denied'}:null}).then(resolve,reject)}};return q}}
}
fs.mkdirSync('.cyborg',{recursive:true})
const outfile=path.resolve('.cyborg/attendance-history-ui.cjs')
await build({entryPoints:['app/teacher/classhub/[id]/attendance-history/page.tsx'],outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'fixtures',setup(b){
b.onResolve({filter:/^(next\/navigation|@\/lib\/supabase|@\/lib\/learner-intelligence\/progress-data|@\/lib\/attendance\/ranges)$/},a=>({path:a.path,namespace:'fixture'}))
b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='next/navigation'?`export const useParams=()=>globalThis.__attendanceScope;export const useRouter=()=>({push:()=>{},back:()=>{}});`:a.path.endsWith('/supabase')?`export const supabase=globalThis.__attendanceFixture.supabase;`:a.path.endsWith('/ranges')?`export const getRangeDates=async()=>({startDate:'2026-10-05',endDate:'2026-10-11'});`:`export const loadProgressAuthority=id=>globalThis.__attendanceFixture.authority(id);export const loadProgressRoster=()=>globalThis.__attendanceFixture.roster();`}))
b.onResolve({filter:/^@\//},a=>{const base=path.resolve(a.path.slice(2));return {path:fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx'}})
}}]})
const Page=createRequire(import.meta.url)(outfile).default
let root=createRoot(document.getElementById('root'))
for(const scenario of ['','records','roster','authority']){
 failure=scenario
 await act(async()=>root.render(React.createElement(Page)))
 if(!scenario){await waitFor(()=>assert(screen.getByText('Transferred learner')));assert(calls.length)}
 else {
 await waitFor(()=>assert(screen.getByRole('alert')))
 assert(!screen.queryByText('Transferred learner'),'A failed load must not show an old roster')
 failure=''
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Try again'})))
 await waitFor(()=>assert(screen.getByText('Transferred learner')))
 }
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root'))
}
await act(async()=>root.unmount())
console.log('Attendance history actual DOM: PASS — canonical roster, scoped real read service, authority/roster/record failures and successful retry; fixture-backed, no live writes.')
