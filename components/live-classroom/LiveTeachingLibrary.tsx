'use client'
import {useEffect,useState,useRef,useCallback} from 'react'
import {SlideCanvas,validSlide,diagramLabel,SLIDE_DIAGRAMS,SLIDE_THEMES,type LiveSlide,type SlideDiagram,type SlideTheme} from './LiveSlideCanvas'
import styles from './LiveClassroom.module.css'
import {SlidePrintPreview} from './LiveSlidePrintPreview'
import {PrivateSlideFields} from './LivePreparedAssessment'
import {SlideBodyEditor} from './LiveSlideBodyEditor'
import {LiveStudioRehearsal} from './LiveStudioRehearsal'
import {LiveResourcePicker} from './LiveResourcePicker'
import {validateStudioResources} from './LiveStudioResourceValidation'
import {exportDeck,importDeck,MAX_DECK_FILE_BYTES,buildTextRevealSlides,isPhotoBody,studioMinutes,setStudioMinutes,studioResource} from './LiveSlideProtocol'
type Summary={id:string;title:string;revision:number;slideCount:number;updatedAt:string}
type Version=Omit<Summary,'id'>
type Material={id:string;title:string;revision:number;slides:LiveSlide[]}
type Command=(action:string,id?:string|null,version?:number|null,payload?:Record<string,unknown>)=>Promise<unknown>
const blank=()=>({title:'',body:''})
function isMaterial(v:unknown):v is Material{
 if(!v||typeof v!=='object')return false
 const m=v as Material
 return typeof m.id==='string'&&typeof m.title==='string'&&Number.isInteger(m.revision)&&m.revision>0&&Array.isArray(m.slides)&&m.slides.length>0&&m.slides.length<=30&&m.slides.every(validSlide)
}
export function TeachingLibrary({command,currentDeck,onUse,onClose}:{command:Command;currentDeck:LiveSlide[]|null;onUse:(m:Material)=>void;onClose?:()=>void}){
 const [items,setItems]=useState<Summary[]>([]),[edit,setEdit]=useState<Material|null>(null),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false)
 const alive=useRef(false),lock=useRef(false),fileInput=useRef<HTMLInputElement>(null)
 const [saveProblem,setSaveProblem]=useState('')
 const [autoSave,setAutoSave]=useState(true)
 const [rehearsing,setRehearsing]=useState(false)
 const [resourceOpen,setResourceOpen]=useState(false)
 const [history,setHistory]=useState<{id:string;versions:Version[]}|null>(null)
 const [printDeck,setPrintDeck]=useState<Material|null>(null)
 const onUseRef=useRef(onUse)
 useEffect(()=>{onUseRef.current=onUse},[onUse])
 async function refresh(){
  const result=await command('materials_list') as {materials?:Summary[]}
  if(!Array.isArray(result.materials))throw Error('Invalid library response')
  if(alive.current)setItems(result.materials)
 }
 useEffect(()=>{alive.current=true;void refresh().catch(e=>{if(alive.current)setError(e instanceof Error?e.message:'Could not load presentations')});return()=>{alive.current=false}},[command])
 async function run(job:()=>Promise<void>){
  if(lock.current)return
  lock.current=true;setBusy(true);setError('')
  try{await job()}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not save presentation. Retry.')}
  finally{lock.current=false;if(alive.current)setBusy(false)}
 }
 function mayReplace(){return !lock.current&&(!dirty||window.confirm('Discard changes that have not reached the server?'))}
 function create(fromCurrent=false){
  if(!mayReplace())return
  const slides=fromCurrent&&currentDeck?currentDeck.map(s=>({...s})):[blank()]
  setEdit({id:crypto.randomUUID(),title:fromCurrent?(slides[0]?.title||'Untitled presentation'):'',revision:0,slides});setIndex(0);setDirty(true);setSaveProblem('')
 }
 function open(item:Summary,use=false,copy=false){
  if(!mayReplace())return
  void run(async()=>{const result=await command('materials_get',null,null,{id:item.id})
   if(!isMaterial(result))throw Error('Invalid presentation response')
   if(!alive.current)return
   if(use){if(onClose)await validateStudioResources(result.slides);if(alive.current)onUse(result);return}
   setEdit(copy?{...result,id:crypto.randomUUID(),title:result.title.slice(0,113)+' (copy)',revision:0}:result);setIndex(0);setDirty(copy);setSaveProblem('')
  })
 }
 function openHistory(item:Summary){
  void run(async()=>{const response=await command('materials_versions',null,null,{id:item.id}) as {versions?:Version[]}
   if(!Array.isArray(response.versions)||!response.versions.every(v=>Number.isInteger(v.revision)&&v.revision>0&&typeof v.title==='string'&&typeof v.updatedAt==='string'&&Number.isInteger(v.slideCount)))throw Error('Invalid version history response.')
   if(alive.current)setHistory({id:item.id,versions:response.versions})
  })
 }
 function restoreVersion(revision:number){
  if(!history||!mayReplace())return
  void run(async()=>{const source=await command('materials_version_get',null,null,{id:history.id,revision})
   if(!isMaterial(source)||source.id!==history.id||source.revision!==revision)throw Error('Invalid saved version.')
   if(!alive.current)return
   setEdit({...source,id:crypto.randomUUID(),title:source.title.slice(0,108)+' (restored)',revision:0});setIndex(0);setDirty(true);setSaveProblem('');setHistory(null)
  })
 }
 function patch(p:Partial<LiveSlide>){
  if(lock.current)return
  setEdit(m=>m?{...m,slides:m.slides.map((s,i)=>i===index?{...s,...p}:s)}:m);setDirty(true)
 }
 const save=useCallback(async(use=false)=>{
  if(!edit||!edit.title.trim()||lock.current)return
  if(!dirty&&edit.revision>0&&!use)return
  lock.current=true;setBusy(true);setSaveProblem('')
  try{
   if(use&&onClose)await validateStudioResources(edit.slides)
   if(!dirty&&edit.revision>0){if(alive.current&&use)onUseRef.current(edit);return}
   const result=await command('materials_save',null,null,{id:edit.id,revision:edit.revision,title:edit.title,slides:edit.slides})
   if(!isMaterial(result)||result.id!==edit.id||result.revision!==edit.revision+1)throw Error('Invalid presentation save response.')
   if(!alive.current)return
   setEdit(result);setDirty(false)
   setItems(items=>[{id:result.id,title:result.title,revision:result.revision,slideCount:result.slides.length,updatedAt:new Date().toISOString()},...items.filter(item=>item.id!==result.id)])
   if(use)onUseRef.current(result)
  }catch(e){
   if(alive.current)setSaveProblem(e instanceof Error?e.message:'Could not save. Retry.')
  }finally{lock.current=false;if(alive.current)setBusy(false)}
 },[edit,dirty,command,onClose])
 useEffect(()=>{
  if(!autoSave||!dirty||busy||saveProblem||!edit?.title.trim())return
  const timer=window.setTimeout(()=>void save(),1500)
  return()=>window.clearTimeout(timer)
 },[autoSave,dirty,busy,saveProblem,edit,save])
 useEffect(()=>{
  if(!dirty)return
  const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''}
  window.addEventListener('beforeunload',warn)
  return()=>window.removeEventListener('beforeunload',warn)
 },[dirty])
 function preserveCopy(){
  if(!edit||lock.current)return
  setEdit({...edit,id:crypto.randomUUID(),revision:0,title:edit.title.slice(0,109)+' (recovered)'})
  setDirty(true);setSaveProblem('')
 }

 function download(){
  if(!edit||busy)return
  setError('')
  try{const content=exportDeck(edit.title,edit.slides);const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));try{const link=document.createElement('a');link.href=url;link.download='vibeschool-presentation.json';document.body.appendChild(link);try{link.click()}finally{link.remove()}}finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000)}}catch(e){setError(e instanceof Error?e.message:'Could not export presentation.')}
 }
 function downloadPowerPoint(){
  if(!edit||busy)return
  void run(async()=>{const {exportPowerPoint}=await import('./LiveSlidePowerPoint');const blob=exportPowerPoint(edit.slides);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='vibeschool-slides.pptx';document.body.appendChild(link);try{link.click()}finally{link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}})
 }
 function loadFile(file:File){
  if(busy||lock.current||!mayReplace())return
  void run(async()=>{const isPdf=/\.pdf$/i.test(file.name)||file.type==='application/pdf';let deck:{title:string;slides:LiveSlide[]};if(isPdf){const {importPdfSlides}=await import('./LiveSlidePdfImport');deck=await importPdfSlides(file)}else if(/\.pptx$/i.test(file.name)){if(!window.confirm('Import editable PowerPoint text? Original pictures, shapes, animations and layout will not be preserved.'))return;const {importPowerPoint}=await import('./LiveSlidePowerPoint');deck=await importPowerPoint(file)}else{if(file.size>MAX_DECK_FILE_BYTES)throw Error('Presentation file is too large.');deck=importDeck(await file.text())}if(!alive.current)return;setEdit({id:crypto.randomUUID(),title:deck.title,slides:deck.slides,revision:0});setIndex(0);setDirty(true);setSaveProblem('')})
 }
 function changeDeck(slides:LiveSlide[],nextIndex:number){if(lock.current)return;setEdit(m=>m?{...m,slides}:m);setIndex(nextIndex);setDirty(true)}
 function move(delta:number){if(!edit)return;const target=index+delta;if(target<0||target>=edit.slides.length)return;const next=[...edit.slides];[next[index],next[target]]=[next[target],next[index]];changeDeck(next,target)}
 const slide=edit?.slides[index]
 if(history)return <section className={styles.slideFields} aria-label="Presentation versions"><div className={styles.controls}><strong>Version history</strong><button type="button" disabled={busy} onClick={()=>setHistory(null)}>Back to preparation</button></div>{error&&<p role="alert">{error}</p>}<small>Latest version and up to ten earlier saves. Restore creates a separate copy.</small>{history.versions.map(v=><div key={v.revision} className={styles.controls}><span>Version {v.revision} · {v.title} · {v.slideCount} slides</span><button type="button" disabled={busy} onClick={()=>restoreVersion(v.revision)}>Restore as copy</button></div>)}</section>
 if(resourceOpen&&edit)return <LiveResourcePicker classId={null} lessonPlanId={null} schemeLessonId={null} canPresent={!busy&&edit.slides.length<30} onPresent={()=>{}} onPrepare={page=>{if(lock.current||edit.slides.length>=30)return;changeDeck([...edit.slides,page],edit.slides.length);setResourceOpen(false)}} onClose={()=>setResourceOpen(false)}/>
 if(rehearsing&&edit)return <LiveStudioRehearsal slides={edit.slides} onClose={()=>setRehearsing(false)}/>
 return <div className={styles.teachingLibrary}>
  {onClose&&<div className={styles.slideToolbar}><strong>Live Studio</strong><button type="button" disabled={busy} onClick={()=>{if(mayReplace())onClose()}}>Back to Go Live</button></div>}
 {printDeck&&<SlidePrintPreview title={printDeck.title} slides={printDeck.slides} onClose={()=>setPrintDeck(null)}/>}
  <div className={styles.controls}><button type="button" disabled={busy} onClick={()=>create()}>New presentation</button>{currentDeck&&<button type="button" disabled={busy} onClick={()=>create(true)}>Save current deck</button>}<button type="button" disabled={busy} onClick={()=>fileInput.current?.click()}>Import JSON / PDF / PPTX</button><input ref={fileInput} type="file" accept=".json,application/json,.pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)loadFile(file)}}/><button type="button" disabled={busy} onClick={()=>void run(refresh)}>Refresh</button></div>
  {error&&<p role="alert">{error}</p>}
  <div className={styles.materialList}>{items.length===0?<p>No saved presentations</p>:items.map(item=><div key={item.id}><div><strong>{item.title}</strong><small>{item.slideCount} slides</small></div><button disabled={busy} onClick={()=>open(item)}>Edit</button>{onClose&&<button type="button" disabled={busy} onClick={()=>open(item,false,true)}>Duplicate</button>}{onClose&&<button type="button" disabled={busy} onClick={()=>openHistory(item)}>Versions</button>}<button disabled={busy} onClick={()=>open(item,true)}>Use</button><button disabled={busy} onClick={()=>{if(!window.confirm('Delete this saved presentation? Shared lesson history remains.'))return;void run(async()=>{await command('materials_delete',null,null,{id:item.id,revision:item.revision});if(alive.current&&edit?.id===item.id){setEdit(null);setDirty(false)}await refresh()})}}>Delete</button></div>)}</div>
  {edit&&slide&&<section className={styles.slideFields} aria-label="Prepare presentation">
   <label><input type="checkbox" checked={autoSave} disabled={busy} onChange={e=>setAutoSave(e.target.checked)}/> Auto-save</label>
   {saveProblem&&<div role="alert"><p>{saveProblem.includes('live_material_conflict')?'A newer version exists. Your draft is intact. Save a separate recovered copy or reopen the latest saved version.':saveProblem}</p><button type="button" disabled={busy} onClick={()=>void save()}>Retry save</button>{saveProblem.includes('live_material_conflict')&&<button type="button" disabled={busy} onClick={preserveCopy}>Recover as new copy</button>}</div>}
   {onClose&&<button type="button" disabled={busy||edit.slides.length>=30} onClick={()=>setResourceOpen(true)}>Add approved resource page</button>}
   <label>Presentation name<input value={edit.title} maxLength={120} disabled={busy} onChange={e=>{if(lock.current)return;setEdit({...edit,title:e.target.value});setDirty(true)}}/></label>
   {onClose&&<section aria-label="Lesson flow"><strong>Lesson flow · {edit.slides.reduce((sum,s)=>sum+studioMinutes(s),0)} min planned</strong><ol>{edit.slides.map((step,i)=><li key={i}><button type="button" disabled={busy} aria-current={i===index?'step':undefined} onClick={()=>setIndex(i)}>{step.title||'Untitled stage'} · {studioMinutes(step)||'—'} min</button></li>)}</ol><label>Stage duration (minutes)<select value={studioMinutes(slide)} disabled={busy} onChange={e=>{const notes=setStudioMinutes(slide,Number(e.target.value));if(notes===null)setError('Shorten the private notes before adding a duration.');else patch({notes})}}><option value={0}>Not set</option>{Array.from({length:120},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label>{studioResource(slide)&&<small>Linked certified resource · checked before use.</small>}</section>}
   <SlideCanvas slide={slide} number={index+1} total={edit.slides.length} ownerPhotoPreview/>
   <nav aria-label="Presentation thumbnails" style={{display:'flex',gap:8,overflowX:'auto',padding:4}}>{edit.slides.map((item,i)=><button type="button" key={i} disabled={busy} aria-pressed={i===index} aria-label={'Slide '+(i+1)+': '+item.title} style={{flex:'0 0 110px',border:i===index?'2px solid #087e72':'1px solid #92b5a8',padding:3,background:'#fff'}} onClick={()=>setIndex(i)}><SlideCanvas slide={item} number={i+1} total={edit.slides.length} mini ownerPhotoPreview/></button>)}</nav>
   <div className={styles.slideToolbar}><button type="button" disabled={busy||index===0} onClick={()=>move(-1)}>Move left</button><button type="button" disabled={busy||index===edit.slides.length-1} onClick={()=>move(1)}>Move right</button><button type="button" disabled={busy||edit.slides.length>=30} onClick={()=>changeDeck([...edit.slides.slice(0,index+1),{...slide},...edit.slides.slice(index+1)],index+1)}>Duplicate slide</button><button type="button" disabled={busy||buildTextRevealSlides(slide,31-edit.slides.length).length===0} onClick={()=>{const steps=buildTextRevealSlides(slide,31-edit.slides.length);if(steps.length&&window.confirm('Replace this slide with '+steps.length+' progressive teaching steps?'))changeDeck([...edit.slides.slice(0,index),...steps,...edit.slides.slice(index+1)],index)}}>Build reveal steps</button></div>
   <div className={styles.slideToolbar}><button disabled={busy||index===0} onClick={()=>setIndex(i=>i-1)}>Previous</button><span>{index+1} / {edit.slides.length}</span><button disabled={busy||index===edit.slides.length-1} onClick={()=>setIndex(i=>i+1)}>Next</button><button disabled={busy||edit.slides.length>=30} onClick={()=>{setEdit({...edit,slides:[...edit.slides,blank()]});setIndex(edit.slides.length);setDirty(true)}}>+ Slide</button><button disabled={busy||edit.slides.length<=1} onClick={()=>{setEdit({...edit,slides:edit.slides.filter((_,i)=>i!==index)});setIndex(i=>Math.max(0,i-1));setDirty(true)}}>Delete slide</button></div>
   <label>Quick template<select value="" disabled={busy} onChange={e=>{const value=e.target.value;if(!value)return;if((slide.title||slide.body)&&!window.confirm('Replace slide text with this template?'))return;const templates:Record<string,Partial<LiveSlide>>={goal:{title:'Learning goal',body:'By the end of this lesson, you will be able to…'},example:{title:'Worked example',body:'Problem:\nStep 1:\nStep 2:\nAnswer:'},question:{title:'Try it',body:'Question:\nThink about your answer.'},summary:{title:'Remember',body:'Key idea:\nExample:'}};patch(templates[value]??{})}}><option value="">Choose a template</option><option value="goal">Learning goal</option><option value="example">Worked example</option><option value="question">Question</option><option value="summary">Summary</option></select></label>
   <label>Slide title<input disabled={busy} value={slide.title} maxLength={120} onChange={e=>patch({title:e.target.value})}/></label>
   <SlideBodyEditor key={edit.id+':'+index} slide={slide} disabled={busy} onChange={body=>patch({body})}/>
   <div className={styles.slideOptions}>
    <label>Diagram<select aria-label="Diagram" disabled={busy} value={slide.diagram??'none'} onChange={e=>patch({diagram:e.target.value as SlideDiagram})}>{SLIDE_DIAGRAMS.map(d=><option key={d} value={d}>{diagramLabel(d)}</option>)}</select></label>
    <label>Theme<select aria-label="Theme" disabled={busy} value={slide.theme??'paper'} onChange={e=>patch({theme:e.target.value as SlideTheme})}>{SLIDE_THEMES.map(t=><option key={t}>{t}</option>)}</select></label>
    <label>Layout<select aria-label="Layout" disabled={busy} value={slide.layout??'wide'} onChange={e=>patch({layout:e.target.value==='portrait'?'portrait':'wide'})}><option value="wide">Wide</option><option value="portrait">Portrait</option></select></label>
    <label>Text size<select aria-label="Text size" disabled={busy} value={slide.font??'normal'} onChange={e=>patch({font:e.target.value==='large'?'large':'normal'})}><option value="normal">Normal</option><option value="large">Large</option></select></label>
   </div>
   <PrivateSlideFields key={edit.id+':private:'+index} slide={slide} disabled={busy} onChange={notes=>patch({notes})}/>
   <div className={styles.controls}><button className={styles.primary} disabled={busy||!edit.title.trim()} onClick={()=>void save()}>Save presentation</button><button disabled={busy||!edit.title.trim()} onClick={()=>void save(true)}>{onClose?"Save & prepare for Live":"Save & use"}</button>{onClose&&<button type="button" disabled={busy||!edit.slides.some(s=>s.title.trim()||s.body.trim())} onClick={()=>setRehearsing(true)}>Preview & rehearse</button>}<button disabled={busy} onClick={()=>{if(mayReplace()){setEdit(null);setDirty(false);setSaveProblem('')}}}>Close editor</button><button type="button" disabled={busy||!edit.title.trim()} onClick={download} >Export slides (without private notes)</button><button type="button" disabled={busy||!edit.title.trim()||edit.slides.some(s=>isPhotoBody(s.body))} onClick={()=>setPrintDeck(edit)}>Print / Save PDF</button><button type="button" disabled={busy||!edit.title.trim()} onClick={downloadPowerPoint}>Export PowerPoint text</button><small>{busy?'Saving…':dirty?'Changes not yet saved':edit.revision>0?'Saved privately · recover from My Presentations':'New presentation'}</small></div>
  </section>}
 </div>
}
