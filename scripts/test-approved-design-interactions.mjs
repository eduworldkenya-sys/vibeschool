/** Isolated approved UI interactions. Fixtures do not certify live data or permissions. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const modules=process.env.PROGRESS_UI_MODULES||'/tmp/progress-ui/node_modules'
const {JSDOM}=await import(pathToFileURL(`${modules}/jsdom/lib/api.js`))
const {build}=await import(pathToFileURL(`${modules}/esbuild/lib/main.js`))
const {fireEvent}=await import(pathToFileURL(`${modules}/@testing-library/dom/dist/index.js`))
const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true})
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
const React=await import('react'),{createRoot}=await import('react-dom/client')
const {act}=React,require=createRequire(import.meta.url)
async function load(entry){
 const outfile=path.resolve(`.next/approved-design-tests/${path.basename(entry)}-approved-test.cjs`)
 await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],loader:{'.css':'empty'},plugins:[{name:'next-fixture',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useRouter=()=>({push:()=>{}})',loader:'js'}))}},{name:'repo-alias',setup(b){b.onResolve({filter:/^@\//},args=>{const file=path.resolve(args.path.slice(2));return {path:file+(fs.existsSync(file+'.ts')?'.ts':'.tsx')}})}}]})
 return require(outfile).default
}
let root
async function render(Component,props){if(root)await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(Component,props)))}
// Bind DOM queries after global document exists.
const query=await import(pathToFileURL(`${modules}/@testing-library/dom/dist/queries/index.js`))
const role=(name)=>query.getByRole(document.body,'button',{name})
const Preparation=await load('components/teacher/LessonPreparationStudio.tsx')
const sections={objectives:'Compare materials',resources:'Wood and metal',introduction:'Observe an object',development:'Describe two properties',consolidation:'Sort objects',assessmentHook:'Explain a choice',homework:'Find an example',differentiation:''}
let edits=0,teaches=0
await render(Preparation,{sections,topic:'Materials',resourceCount:0,onEdit:()=>edits++,onTeach:()=>teaches++})
assert(document.body.textContent.includes('Observe an object'))
await act(async()=>fireEvent.click(role(/Explore & explain/)))
assert(document.body.textContent.includes('Describe two properties'))
assert(!document.body.textContent.includes('Observe an object'))
await act(async()=>fireEvent.click(role(/Differentiate/)))
assert(document.body.textContent.includes('No content saved here yet'))
assert(document.body.textContent.includes('0 attached items'))
await act(async()=>fireEvent.click(role('Edit plan')))
await act(async()=>fireEvent.click(role(/Open Teach Mode/)))
assert.equal(edits,1);assert.equal(teaches,1)
const longIntroduction='Start with a recorded example. '.repeat(40)
await render(Preparation,{sections:{...sections,introduction:longIntroduction},topic:'Materials',resourceCount:1,onEdit:()=>{},onTeach:()=>{}})
assert.equal(document.querySelector('details').open,false,'Long saved content starts behind disclosure')
assert(document.querySelector('details').textContent.includes(longIntroduction.trim()),'Disclosure preserves the whole saved phase')
const Matrix=await load('components/teacher/progress/OutcomeMatrix.tsx')
const outcome=(studentId,band)=>({key:JSON.stringify([studentId,'math','fraction']),studentId,subjectId:'math',outcomeId:'fraction',outcomeText:'Fractions',band,evidenceCount:1,evidence:[{id:studentId,source:'observation',observedAt:'2026-10-09',score:null,maxScore:null,proficiency:band,notes:'Recorded classroom evidence'}]})
let learner=''
await render(Matrix,{learners:[{id:'a',name:'Amina',outcomes:[outcome('a','ME')]},{id:'b',name:'Brian',outcomes:[outcome('b','BE')]},{id:'c',name:'Carol',outcomes:[]}],onOpenLearner:id=>learner=id})
assert.equal(document.querySelectorAll('thead th').length,2,'One shared outcome column across learners')
await act(async()=>fireEvent.click(role('Brian, Fractions, Below expectation')))
assert(document.body.textContent.includes('Recorded classroom evidence'))
await act(async()=>fireEvent.click(role('Carol, Fractions, No recorded performance level')))
assert(document.body.textContent.includes('No recorded evidence for this learner'))
await act(async()=>fireEvent.click(role('Amina')))
assert.equal(learner,'a')
await render(Matrix,{learners:[{id:'d',name:'Diana',outcomes:[outcome('d','AE')]}],onOpenLearner:()=>{}})
assert(!document.body.textContent.includes('Recorded classroom evidence'),'Changing the learner scope clears old selected evidence')
const EvidenceChart=await load('components/teacher/progress/LearnerEvidenceChart.tsx')
const chartOutcome={...outcome('a','ME'),trend:'improving',trendSource:'released_assessment',trendDelta:10,trendEvidenceCount:4,evidence:[{id:'other',source:'exercise',observedAt:'2026-10-10',score:99,maxScore:100},{id:'comparable',source:'released_assessment',observedAt:'2026-10-09',score:40,maxScore:100}]}
await render(EvidenceChart,{outcomes:[chartOutcome]})
assert(document.body.textContent.includes('40 / 100'),'The trend chart shows the comparable source')
assert(!document.body.textContent.includes('99 / 100'),'An unrelated source cannot supply bars for the trend')
const TeachMode=await load('components/teacher/LessonTeachMode.tsx')
let openedResource=''
await render(TeachMode,{subject:'Science',className:'Grade 4',topic:'Materials',sections,linkedResources:[{id:'book',title:'Prepared reader',available:true},{id:'missing',title:'Unavailable reader',available:false}],onOpenResource:id=>openedResource=id,onClose:()=>{}})
await act(async()=>fireEvent.click(document.querySelector('details summary')))
await act(async()=>fireEvent.click(role('Resources')))
assert.equal(role('Unavailable reader · Reader unavailable').disabled,true,'Unavailable readers remain disabled')
await act(async()=>fireEvent.click(role('Prepared reader ↗')))
assert.equal(openedResource,'book','The selected linked resource reaches its real caller')
await act(async()=>root.unmount())
console.log('Approved design interactions: PASS (phases, full-content disclosure, edit/teach, shared matrix, scope reset, evidence, comparable chart source, linked readers)')
