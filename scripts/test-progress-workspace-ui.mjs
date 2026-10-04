/** Isolated component evidence; no production sessions, RLS or official report certification. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
const modules=process.env.PROGRESS_UI_MODULES||'/tmp/progress-ui/node_modules'
const {JSDOM}=await import(pathToFileURL(`${modules}/jsdom/lib/api.js`))
const {build}=await import(pathToFileURL(`${modules}/esbuild/lib/main.js`))
const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'http://localhost/teacher/classhub/class/progress'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
const React=await import('react'),{createRoot}=await import('react-dom/client'),{fireEvent,screen,waitFor}=await import(pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`))
const {act}=React
const now=new Date(),year=now.getUTCFullYear()
const authority={teacherId:'teacher',schoolId:'school',classId:'class',className:'Grade 6 Yellow',subjects:[{id:'math',name:'Mathematics'}]}
const learners=[{id:'a',name:'Charles',admission_number:'1024',isCurrent:true,joinedAt:'2026-09-01',leftAt:null},{id:'b',name:'Mary',admission_number:'1025',isCurrent:true,joinedAt:'2026-09-01',leftAt:null}]
const evidence=[{id:'e',studentId:'a',subjectId:'math',outcomeId:'fractions',outcomeText:'Fractions',outcomeCode:'M1',source:'quiz',sourceId:'q',observedAt:now.toISOString(),score:0,maxScore:100,proficiency:'BE',notes:'Needs another example',weight:1}]
Object.assign(globalThis,{__progressAuthority:authority,__progressLearners:learners,__progressEvidence:evidence,__progressTerms:[{id:'term',name:'Actual school term',start_date:`${year}-01-01`,end_date:`${year}-12-31`}],__progressParams:{id:'class',studentId:'a'},__progressSearch:new URLSearchParams(),__progressRoutes:[],__progressPrints:0,__progressDelay:null})
dom.window.print=()=>{globalThis.__progressPrints++}
fs.mkdirSync('.cyborg',{recursive:true})
const require=createRequire(import.meta.url)
async function component(entry,label){
 const outfile=path.resolve(`.cyborg/${label}-ui.cjs`)
 await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'isolated-progress-boundary',setup(builder){
  builder.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}))
  builder.onResolve({filter:/^@\/lib\/learner-intelligence\/progress-data$/},()=>({path:'data',namespace:'fixture'}))
  builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='navigation'
   ? `export const useParams=()=>globalThis.__progressParams;export const useSearchParams=()=>globalThis.__progressSearch;export const useRouter=()=>({push:url=>globalThis.__progressRoutes.push(url)});`
   : `export async function loadProgressAuthority(id){if(globalThis.__progressDelay?.id===id)await globalThis.__progressDelay.promise;return {...globalThis.__progressAuthority,classId:id,className:id==='other'?'Grade 7 Blue':globalThis.__progressAuthority.className};}export async function loadProgressRoster(scope,history){if(history)throw new Error('Historical learner identity access is not available');return structuredClone(globalThis.__progressLearners);}export async function loadProgressEvidence(scope,student){return structuredClone(globalThis.__progressEvidence.filter(row=>!student||row.studentId===student));}export async function loadProgressAttendance(){return [];}export async function loadProgressTerms(){return structuredClone(globalThis.__progressTerms);}`}))
  builder.onResolve({filter:/^@\//},args=>({path:path.resolve(args.path.slice(2)+(fs.existsSync(args.path.slice(2)+'.ts')?'.ts':'.tsx'))}))
 }}]})
 return require(outfile).default
}
const Class=await component('app/teacher/classhub/[id]/progress/page.tsx','progress-class')
const Learner=await component('app/teacher/classhub/[id]/student/[studentId]/progress/page.tsx','progress-learner')
let root=createRoot(document.getElementById('root'))
await act(async()=>{root.render(React.createElement(Class))})
await waitFor(()=>assert(screen.getByRole('heading',{name:/Student Progress Record/})))
assert(screen.getByText('Charles'));assert(screen.getByText('Mary'))
assert(screen.getByText(/1 of 1 learners with recorded levels need support/))
assert(!document.body.textContent.includes('% avg'))
await act(async()=>{fireEvent.change(screen.getByLabelText('Progress status'),{target:{value:'no-evidence'}})})
assert(!screen.queryByText('Charles'));assert(screen.getByText('Mary'))
await act(async()=>{fireEvent.change(screen.getByLabelText('Progress status'),{target:{value:'all'}});fireEvent.click(screen.getByRole('button',{name:'Open record sheet'}))})
assert.equal(globalThis.__progressRoutes.at(-1),'/teacher/classhub/class/workbook?sheet=progress')
await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Print class record'}))})
assert.equal(globalThis.__progressPrints,1)
await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Archived learners'}))})
await waitFor(()=>assert(screen.getByRole('alert').textContent.includes('Historical learner identity access')))
assert(!screen.queryByText('No archived learners match this view.'))
await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Current learners'}))})
await waitFor(()=>assert(screen.getByText('Charles')))
await act(async()=>{root.unmount()})
root=createRoot(document.getElementById('root'))
globalThis.__progressTerms=[]
await act(async()=>{root.render(React.createElement(Class))})
await waitFor(()=>assert(screen.getByRole('status').textContent.includes('No single school term')))
assert(!screen.queryByLabelText('Class evidence overview'),'missing term must not fabricate whole-class no-evidence claims')
await act(async()=>{fireEvent.change(screen.getByLabelText('Period'),{target:{value:'all'}})})
assert(screen.getByText('Charles'))
await act(async()=>{root.unmount()})
root=createRoot(document.getElementById('root'))
globalThis.__progressTerms=[{id:'term',name:'Actual school term',start_date:`${year}-01-01`,end_date:`${year}-12-31`}]
let resume
globalThis.__progressDelay={id:'class',promise:new Promise(resolve=>{resume=resolve})}
await act(async()=>{root.render(React.createElement(Class))})
globalThis.__progressParams={id:'other',studentId:'a'}
await act(async()=>{root.render(React.createElement(Class))})
await waitFor(()=>assert(screen.getByRole('heading',{name:/Grade 7 Blue/})))
await act(async()=>{resume();await Promise.resolve()})
assert(screen.getByRole('heading',{name:/Grade 7 Blue/}),'late previous-class response must not replace new scope')
await act(async()=>{root.unmount()})
root=createRoot(document.getElementById('root'))
globalThis.__progressDelay=null;globalThis.__progressParams={id:'class',studentId:'a'};globalThis.__progressSearch=new URLSearchParams('subjectId=math')
await act(async()=>{root.render(React.createElement(Learner))})
await waitFor(()=>assert(screen.getByRole('heading',{name:'Charles'})))
assert.equal(screen.getByLabelText('Subject').value,'math')
assert(screen.getByText('0% latest observation'))
assert(screen.getByText('Not enough comparable evidence for a trend'))
await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Review support & reassessment'}))})
assert.equal(globalThis.__progressRoutes.at(-1),'/teacher/assessment/interventions?classId=class&studentId=a&subjectId=math')
await act(async()=>{fireEvent.click(screen.getByRole('button',{name:/History \(/}))})
assert(screen.getByLabelText('Progress history'));assert(screen.getByText('0% · Mathematics'))
await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Print record'}))})
assert.equal(globalThis.__progressPrints,2)
await act(async()=>{root.unmount()})
console.log('Progress workspace DOM: PASS — class/learner filters, zero evidence score, correct context links, print invocation, archive recovery, real-term empty state, and stale-scope rejection. Not a signed-in production journey.')
