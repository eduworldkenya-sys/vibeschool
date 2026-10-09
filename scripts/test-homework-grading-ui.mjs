/** Actual homework page interactions; isolated fixtures never contact Supabase. */
import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const repo=path.resolve('.')
const modules=process.env.WORKBOOK_UI_MODULES||'/tmp/workbook-ui/node_modules'
const {JSDOM}=await import(pathToFileURL(`${modules}/jsdom/lib/api.js`))
const {build}=await import(pathToFileURL(`${modules}/esbuild/lib/main.js`))
const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'http://localhost/teacher/classhub/class/homework/work'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
const React=await import(pathToFileURL(repo+'/node_modules/react/index.js'))
const {createRoot}=await import(pathToFileURL(repo+'/node_modules/react-dom/client.js'))
const {fireEvent,screen,waitFor}=await import(pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`))
const {act}=React
let fixture={allowed:true,enrollmentError:false,throwRead:false,saveError:false,mark:null,status:'submitted'}
let calls=[],writes=[]
globalThis.__homeworkParams={id:'class',hwId:'work'}
globalThis.__homeworkFixture={
 auth:{getUser:async()=>({data:{user:{id:'teacher'}}})},
 rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==='teacher_get_operating_context'){const result={data:{teacher_id:'teacher',school_id:'school',classes:fixture.allowed?[{class_id:'class'}]:[]},error:null};const delay=fixture.delayContext;fixture.delayContext=null;if(delay)await delay;return result}
  if(name==='review_homework_submission'){
   writes.push(args)
   if(fixture.saveError)return {error:{message:'Save denied'}}
   fixture.mark=args.p_mark ?? fixture.mark;fixture.status=args.p_action==='marked'?'marked':fixture.status;return {data:{},error:null}
  }
  throw new Error('Unexpected RPC '+name)
 },
 from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},in(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},order(){return q},single(){return q},then(resolve,reject){
 calls.push({table,filters})
 if(fixture.throwRead && table==='student_classes')return Promise.reject(new Error('Network unavailable')).then(resolve,reject)
 if(table==='student_classes')return Promise.resolve({data:[{student_id:'learner'}],error:fixture.enrollmentError?{message:'Denied'}:null}).then(resolve,reject)
 if(table==='students'){assert(filters.some(([k,v])=>k==='id'&&Array.isArray(v)&&v.includes('learner')));assert(!filters.some(([k])=>k==='class_id'));return Promise.resolve({data:[{id:'learner',name:'Transferred learner',admission_number:'001',profile_id:null}],error:null}).then(resolve,reject)}
 if(table==='homework'){for(const required of [['school_id','school'],['class_id','class'],['teacher_id','teacher']])assert(filters.some(f=>f[0]===required[0]&&f[1]===required[1]));return Promise.resolve({data:{title:'Fractions',subject:'Maths',due_date:'2026-10-09',instructions:null,type:'written'},error:null}).then(resolve,reject)}
 if(table==='homework_submissions')return Promise.resolve({data:[{id:'submission',student_id:'learner',status:fixture.status,mark:fixture.mark,feedback:null,submitted_at:null,received_at:null,photo_url:null,returned_reason:null}],error:null}).then(resolve,reject)
 if(table==='homework_questions'||table==='homework_answers')return Promise.resolve({data:[],error:null}).then(resolve,reject)
 throw new Error('Unexpected table '+table)
 }};return q}
}
fs.mkdirSync('.cyborg',{recursive:true})
const outfile=path.resolve('.cyborg/homework-grading-ui.cjs')
await build({entryPoints:[repo+'/app/teacher/classhub/[id]/homework/[hwId]/page.tsx'],outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',nodePaths:[repo+'/node_modules'],external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^(next\/navigation|@\/lib\/supabase)$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='next/navigation'?`export const useParams=()=>globalThis.__homeworkParams;export const useRouter=()=>({push:()=>{}});`:`export const supabase=globalThis.__homeworkFixture;`}));b.onResolve({filter:/^@\//},args=>({path:repo+'/'+args.path.slice(2)+'.tsx'}))}}]})
const require=createRequire(repo+'/package.json'),Page=require(outfile).default
let root=createRoot(document.getElementById('root'))
await act(async()=>root.render(React.createElement(Page)))
await waitFor(()=>assert(screen.getByText('Transferred learner')))
assert(calls.some(c=>c.table==='student_classes'&&c.filters.some(([k,v])=>k==='is_current'&&v===true)))
await act(async()=>fireEvent.click(screen.getByRole('button',{name:/Transferred learner/})))
await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Save mark'})))
assert.equal(writes.length,0,'Empty mark must not become zero')
assert(screen.getByRole('alert').textContent.includes('Enter a mark'))
await act(async()=>fireEvent.change(screen.getByLabelText('Mark'),{target:{value:'0'}}))
fixture.saveError=true
await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Save mark'})))
await waitFor(()=>assert(screen.getByRole('alert').textContent.includes('Save denied')))
assert.equal(writes.at(-1).p_mark,0)
fixture.saveError=false
await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Save mark'})))
await waitFor(()=>assert(screen.getByText('Transferred learner')))
assert.equal(fixture.mark,0)
for(const failure of ['enrollmentError','throwRead','allowed']){
 await act(async()=>root.unmount());root=createRoot(document.getElementById('root'))
 fixture.enrollmentError=false;fixture.throwRead=false;fixture.allowed=true;fixture[failure]=failure==='allowed'?false:true
 await act(async()=>root.render(React.createElement(Page)))
 await waitFor(()=>assert(screen.getByRole('alert')))
 assert(!screen.queryByText('No learner submissions yet.'),'Failure must not appear as empty success')
 fixture[failure]=failure==='allowed'?true:false
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Try again'})))
 await waitFor(()=>assert(screen.getByText('Transferred learner')))
}
await act(async()=>root.unmount());root=createRoot(document.getElementById('root'))
let resume
fixture.delayContext=new Promise(resolve=>{resume=resolve})
await act(async()=>root.render(React.createElement(Page)))
globalThis.__homeworkParams={id:'other',hwId:'work'}
await act(async()=>root.render(React.createElement(Page)))
await waitFor(()=>assert(screen.getByRole('alert').textContent.includes('active teaching context')))
await act(async()=>{resume();await Promise.resolve()})
assert(screen.getByRole('alert').textContent.includes('active teaching context'))
assert(!screen.queryByText('Transferred learner'),'A previous class request must not overwrite the new scope')
await act(async()=>root.unmount())
console.log('Homework actual DOM: PASS — current enrollment, school/class/teacher scope, blank vs zero marks, save denial/retry, roster error, network recovery, rejected class access and stale-route rejection. Isolated fixtures only.')
