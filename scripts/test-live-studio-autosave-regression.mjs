import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const source=readFileSync(new URL('../components/live-classroom/LiveTeachingLibrary.tsx',import.meta.url),'utf8')
const from=source.indexOf(' const save=useCallback(async(use=false)=>{')
const to=source.indexOf('\n useEffect(()=>{',from)
assert.ok(from>=0&&to>from)
const saveSource=source.slice(from,to)+'\nsave'
function harness(){
 let draft={id:'deck',title:'Lesson',revision:1,slides:[{title:'First',body:'original'}]}
 let generation=1,savedGeneration=0,busy=false,saving=false,problem=''
 const generationRef={current:1},lock={current:false},saveLock={current:false},acknowledged={current:null},calls=[],pending=[]
 const command=(action,id,version,payload)=>{calls.push({action,payload});return new Promise((resolve,reject)=>pending.push({resolve,reject}))}
 const render=()=>runInNewContext(saveSource,{
  edit:draft, generation, dirty:generation!==savedGeneration,generationRef,lock,saveLock,acknowledged,command,onClose:undefined,alive:{current:true},
  useCallback:fn=>fn,setBusy:v=>{busy=v},setSaving:v=>{saving=v},setSaveProblem:v=>{problem=v},
  isMaterial:v=>!!v&&Array.isArray(v.slides),setEdit:fn=>{draft=fn(draft)},setSavedGeneration:v=>{savedGeneration=v},
  setItems:()=>{},onUseRef:{current:async()=>{}},Error
 })
 return {render,calls,pending,edit(body){assert.equal(lock.current,false);draft={...draft,slides:[{...draft.slides[0],body}]};generationRef.current=++generation},
 get state(){return {draft,generation,savedGeneration,busy,saving,problem,locked:lock.current}},
 ack(i){const p=calls[i].payload;pending[i].resolve({...p,revision:p.revision+1})},
 reject(i){pending[i].reject(new Error('network failure'))}}
}
test('typing during a delayed save survives its acknowledgement and is saved at the next revision',async()=>{
 const h=harness();const first=h.render()()
 assert.equal(h.state.saving,true);assert.equal(h.state.busy,false)
 h.edit('more text');h.edit('latest complete text')
 await h.render()()
 assert.equal(h.calls.length,1)
 h.ack(0);await first
 assert.equal(h.state.draft.slides[0].body,'latest complete text')
 assert.equal(h.state.draft.revision,2)
 assert.notEqual(h.state.generation,h.state.savedGeneration)
 const second=h.render()()
 assert.equal(h.calls[1].payload.revision,2)
 assert.equal(h.calls[1].payload.slides[0].body,'latest complete text')
 h.ack(1);await second
 assert.equal(h.state.generation,h.state.savedGeneration)
 assert.equal(h.state.draft.revision,3)
})
test('failed save leaves local content dirty and can retry without advancing revision',async()=>{
 const h=harness();const first=h.render()();h.edit('keep me');h.reject(0);await first
 assert.equal(h.state.problem,'network failure')
 assert.equal(h.state.draft.slides[0].body,'keep me')
 assert.equal(h.state.draft.revision,1)
 assert.notEqual(h.state.generation,h.state.savedGeneration)
 const next=h.render()();assert.equal(h.calls[1].payload.revision,1);h.ack(1);await next
 assert.equal(h.state.generation,h.state.savedGeneration)
})
test('ordinary save does not disable canonical slide inputs or navigation; launch remains exclusive',async()=>{
 assert.match(source,/<EditableSlideCanvas[^\n]+disabled=\{busy\}/)
 assert.match(source,/<PrivateSlideFields[^\n]+disabled=\{busy\}/)
 assert.match(source,/aria-label="Next slide" disabled=\{busy\|\|/)
 assert.match(source,/\[autoSave,dirty,busy,saving,saveProblem,edit,save\]/)
 const h=harness();const launch=h.render()(true);assert.equal(h.state.locked,true);h.ack(0);await launch;assert.equal(h.state.locked,false)
})
