import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const modules=process.env.WORKBOOK_UI_MODULES||'/tmp/workbook-ui/node_modules'
const {JSDOM}=await import(pathToFileURL(`${modules}/jsdom/lib/api.js`))
const {build}=await import(pathToFileURL(`${modules}/esbuild/lib/main.js`))
const dom=new JSDOM('<div id="root"></div>',{url:'https://vibeschool.co.ke/teacher/results?classId=one'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
const React=await import('react');const {createRoot}=await import('react-dom/client');const {act}=React
let confirmed=0
globalThis.__query='classId=one'
globalThis.__service={
  observe:async()=>{},
  execute:async(input)=>{if(input==='fail')throw new Error('No matching learner');return{text:'Review Charles Maths CAT 40',proposal:{id:'proposal',createdAt:Date.now()}}},
  confirm:async()=>{confirmed++;return{text:'Saved'}},
}
globalThis.__auth=()=>({data:{subscription:{unsubscribe(){}}}})
fs.mkdirSync('.cyborg',{recursive:true})
const output=path.resolve('.cyborg/personal-twin-ui.cjs')
await build({entryPoints:['components/twin/usePersonalTwin.tsx'],outfile:output,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],plugins:[{name:'boundary-fixtures',setup(b){
  b.onResolve({filter:/^next\/navigation$/},()=>({path:'next',namespace:'fixture'}))
  b.onResolve({filter:/^@\/lib\/twin\/service$/},()=>({path:'service',namespace:'fixture'}))
  b.onResolve({filter:/^@\/lib\/(?:hq\/)?supabase$/},()=>({path:'auth',namespace:'fixture'}))
  b.onLoad({filter:/.*/,namespace:'fixture'},({path:p})=>({loader:'js',contents:p==='next'?"export const usePathname=()=>'/teacher/results';export const useSearchParams=()=>new URLSearchParams(globalThis.__query);export const useRouter=()=>({push(){}});":p==='auth'?"export const supabase={auth:{onAuthStateChange:globalThis.__auth}};export const hqSupabase=supabase;":"export const observePersonalTwin=(...a)=>globalThis.__service.observe(...a);export const executePersonalTwin=(...a)=>globalThis.__service.execute(...a);export const confirmPersonalTwinMark=(...a)=>globalThis.__service.confirm(...a);"}))
  b.onResolve({filter:/^@\//},args=>({path:path.resolve(args.path.replace(/^@\//,''))+'.ts'}))
}}]})
const {usePersonalTwin,PersonalTwinActions}=await import(pathToFileURL(output))
let current,oldProposal
function Harness(){current=usePersonalTwin('teacher',false);return React.createElement(PersonalTwinActions,{twin:current})}
const root=createRoot(document.getElementById('root'))
await act(async()=>root.render(React.createElement(Harness)))
await act(async()=>{await current.execute('prepare')})
oldProposal=current.reply.proposal
assert.match(document.body.textContent,/Save this score/)
await act(async()=>{await assert.rejects(()=>current.execute('fail'),/No matching learner/)})
assert.equal(current.reply,null,'failed replacement command must clear the earlier proposal')
await act(async()=>{await current.confirm(oldProposal)})
assert.equal(confirmed,0,'captured stale proposal must not invoke mutation')
await act(async()=>{await current.execute('prepare')})
oldProposal=current.reply.proposal
globalThis.__query='classId=two&examId=changed'
await act(async()=>root.render(React.createElement(Harness)))
assert.equal(current.reply,null,'query-only class/exam changes must clear the review')
await act(async()=>{await current.confirm(oldProposal)})
assert.equal(confirmed,0)
await act(async()=>{await current.execute('prepare')})
oldProposal=current.reply.proposal
await act(async()=>current.dismiss())
await act(async()=>{await current.confirm(oldProposal)})
assert.equal(confirmed,0,'cancel must invalidate captured review')
await act(async()=>{await current.execute('prepare')})
const proposal=current.reply.proposal
await act(async()=>{await Promise.all([current.confirm(proposal),current.confirm(proposal)])})
assert.equal(confirmed,1,'double confirmation must invoke mutation once')
await act(async()=>root.unmount())
fs.unlinkSync(output)
console.log('Personal Twin DOM: preview/confirmation, failed-command clearing, query-context invalidation, cancel and duplicate-click protection passed.')
