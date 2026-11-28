'use client'
import {useEffect,useState,useRef,useCallback} from 'react'
import {SlideCanvas,validSlide,diagramLabel,SLIDE_DIAGRAMS,SLIDE_THEMES,type LiveSlide,type SlideDiagram,type SlideTheme} from './LiveSlideCanvas'
import styles from './LiveClassroom.module.css'
import {SlidePrintPreview} from './LiveSlidePrintPreview'
import {PrivateSlideFields} from './LivePreparedAssessment'
import {SlideBodyEditor} from './LiveSlideBodyEditor'
import {LiveStudioRehearsal} from './LiveStudioRehearsal'
import {TeachingToolsLibrary} from '@/components/learn/tools/TeachingToolsLibrary'
import {LiveResourcePicker} from './LiveResourcePicker'
import {validateStudioResources} from './LiveStudioResourceValidation'
import {StudioFilePreview,uploadStudioFile,validateStudioFiles} from './LiveStudioFiles'
import {importPresentationFile} from './LivePresentationImport'
import {exportDeck,buildTextRevealSlides,isPhotoBody,studioMinutes,setStudioMinutes,studioResource,studioFile,setStudioFile,encodeSlide,type SlideDemo} from './LiveSlideProtocol'
import {composeVisualSlide} from './LiveBoardProtocol'
type Summary={id:string;title:string;revision:number;slideCount:number;updatedAt:string}
type Version=Omit<Summary,'id'>
type Material={id:string;title:string;revision:number;slides:LiveSlide[]}
type Command=(action:string,id?:string|null,version?:number|null,payload?:Record<string,unknown>)=>Promise<unknown>
const blank=()=>({title:'',body:''})
export function isMaterial(v:unknown):v is Material{
 if(!v||typeof v!=='object')return false
 const m=v as Material
 return typeof m.id==='string'&&typeof m.title==='string'&&Number.isInteger(m.revision)&&m.revision>0&&Array.isArray(m.slides)&&m.slides.length>0&&m.slides.length<=30&&m.slides.every(validSlide)
}
export function TeachingLibrary({command,currentDeck,onUse,onClose,attachToPlan=false}:{command:Command;currentDeck:LiveSlide[]|null;onUse:(m:Material)=>void|Promise<void>;onClose?:()=>void;attachToPlan?:boolean}){
 const [items,setItems]=useState<Summary[]>([]),[edit,setEdit]=useState<Material|null>(null),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [generation,setGeneration]=useState(0),[savedGeneration,setSavedGeneration]=useState(0)
 const generationRef=useRef(0)
 const markDirty=()=>{generationRef.current++;setGeneration(generationRef.current)}
 const markClean=()=>setSavedGeneration(generationRef.current)
 const dirty=generation!==savedGeneration
 const [saving,setSaving]=useState(false)
 const saveLock=useRef(false)
 const acknowledged=useRef<{id:string;revision:number}|null>(null)
 const exclusiveBusy=busy||saving
 const alive=useRef(false),lock=useRef(false),fileInput=useRef<HTMLInputElement>(null)
 const [saveProblem,setSaveProblem]=useState('')
 const [autoSave,setAutoSave]=useState(true)
 const [studioTab,setStudioTab]=useState<'Slides'|'Resources'|'Tools'|'Flow'|'Notes'>('Slides')
 const [tool,setTool]=useState<'Content'|'Theme'|null>(null)
 const [libraryTab,setLibraryTab]=useState<'Presentations'|'Resources'|'Tools'|'History'>('Presentations')
 const [search,setSearch]=useState('')
 const entryTab=useRef<'Slides'|'Resources'>('Slides')
 const dragSlide=useRef<number|null>(null)
 useEffect(()=>{setStudioTab(entryTab.current);entryTab.current='Slides';setTool('Content')},[edit?.id])
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
  if(lock.current||saveLock.current)return
  lock.current=true;setBusy(true);setError('')
  try{await job()}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not save presentation. Retry.')}
  finally{lock.current=false;if(alive.current)setBusy(false)}
 }
 function mayReplace(){return !lock.current&&!saveLock.current&&(!dirty||window.confirm('Discard changes that have not reached the server?'))}
 function create(fromCurrent=false,target:'Slides'|'Resources'='Slides'){
  if(!mayReplace())return
  entryTab.current=target
  const slides=fromCurrent&&currentDeck?currentDeck.map(s=>({...s})):[blank()]
  setEdit({id:crypto.randomUUID(),title:fromCurrent?(slides[0]?.title||'Untitled presentation'):'Untitled presentation',revision:0,slides});setIndex(0);markDirty();setSaveProblem('')
 }
 function open(item:Summary,use=false,copy=false,target:'Slides'|'Resources'='Slides'){
  if(!mayReplace())return
  void run(async()=>{const result=await command('materials_get',null,null,{id:item.id})
   if(!isMaterial(result))throw Error('Invalid presentation response')
   if(!alive.current)return
   if(use){if(onClose){await validateStudioResources(result.slides);await validateStudioFiles(result.slides)}if(alive.current)await onUse(result);return}
   entryTab.current=target
   setEdit(copy?{...result,id:crypto.randomUUID(),title:result.title.slice(0,113)+' (copy)',revision:0}:result);setIndex(0);copy?markDirty():markClean();setSaveProblem('')
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
   setEdit({...source,id:crypto.randomUUID(),title:source.title.slice(0,108)+' (restored)',revision:0});setIndex(0);markDirty();setSaveProblem('');setHistory(null)
  })
 }
 function patch(p:Partial<LiveSlide>){
  if(lock.current)return
  setEdit(m=>m?{...m,slides:m.slides.map((s,i)=>i===index?{...s,...p}:s)}:m);markDirty()
 }
 const save=useCallback(async(use=false)=>{
  if(!edit||!edit.title.trim()||lock.current||saveLock.current||generation!==generationRef.current)return
  if(acknowledged.current?.id===edit.id&&acknowledged.current.revision>edit.revision)return
  if(!dirty&&edit.revision>0&&!use)return
  const snapshot=edit, submittedGeneration=generation
  // Ordinary saves never disable the editor. Launch/attach is exclusive.
  saveLock.current=true;setSaving(true);setSaveProblem('')
  if(use){lock.current=true;setBusy(true)}
  try{
   if(use&&onClose){await validateStudioResources(snapshot.slides);await validateStudioFiles(snapshot.slides)}
   if(!dirty&&snapshot.revision>0){if(alive.current&&use)await onUseRef.current(snapshot);return}
   const result=await command('materials_save',null,null,{id:snapshot.id,revision:snapshot.revision,title:snapshot.title,slides:snapshot.slides})
   if(!isMaterial(result)||result.id!==snapshot.id||result.revision!==snapshot.revision+1)throw Error('Invalid presentation save response.')
   if(!alive.current)return
   acknowledged.current={id:result.id,revision:result.revision}
   // Advance the revision without discarding changes typed during the request.
   setEdit(current=>current?.id===snapshot.id?{...current,revision:result.revision}:current)
   setSavedGeneration(submittedGeneration)
   setItems(items=>[{id:result.id,title:result.title,revision:result.revision,slideCount:result.slides.length,updatedAt:new Date().toISOString()},...items.filter(item=>item.id!==result.id)])
   if(use)await onUseRef.current(result)
  }catch(e){
   if(alive.current)setSaveProblem(e instanceof Error?e.message:'Could not save. Retry.')
  }finally{saveLock.current=false;if(use)lock.current=false;if(alive.current){setSaving(false);if(use)setBusy(false)}}
 },[edit,dirty,generation,command,onClose])
 useEffect(()=>{
  if(!autoSave||!dirty||busy||saving||saveProblem||!edit?.title.trim())return
  const timer=window.setTimeout(()=>void save(),1500)
  return()=>window.clearTimeout(timer)
 },[autoSave,dirty,busy,saving,saveProblem,edit,save])
 useEffect(()=>{
  if(!dirty)return
  const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''}
  window.addEventListener('beforeunload',warn)
  return()=>window.removeEventListener('beforeunload',warn)
 },[dirty])
 function preserveCopy(){
  if(!edit||lock.current||saveLock.current)return
  setEdit({...edit,id:crypto.randomUUID(),revision:0,title:edit.title.slice(0,109)+' (recovered)'})
  markDirty();setSaveProblem('')
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
  if(busy||lock.current||saveLock.current||!mayReplace())return
  void run(async()=>{if(/\.pptx$/i.test(file.name)&&!window.confirm('Import editable PowerPoint text? Original pictures, shapes, animations and layout will not be preserved.'))return;const deck=await importPresentationFile(file);if(!alive.current)return;setEdit({id:crypto.randomUUID(),title:deck.title,slides:deck.slides,revision:0});setIndex(0);markDirty();setSaveProblem('')})
 }
 function attachFile(file:File){
  if(!edit||lock.current||saveLock.current||edit.slides.length>=30)return
  void run(async()=>{const ref=await uploadStudioFile(file);if(!alive.current)return
   const stage:LiveSlide={title:file.name.replace(/\.[^.]+$/,'').trim().slice(0,120)||'Prepared file',body:'Prepared teaching file'}
   const notes=setStudioFile(stage,ref);if(!notes)throw Error('Could not attach the file.')
   setEdit({...edit,slides:[...edit.slides,{...stage,notes}]});setIndex(edit.slides.length);markDirty()
  })
 }
 function changeDeck(slides:LiveSlide[],nextIndex:number){if(lock.current)return;setEdit(m=>m?{...m,slides}:m);setIndex(nextIndex);markDirty()}
 function prepareDemo(demo:SlideDemo){
  if(!edit||lock.current)return
  const current=edit.slides[index];if(!current)return
  if(studioFile(current)||studioResource(current)){setError('Choose a regular slide before inserting a teaching tool. The linked resource is unchanged.');return}
  const body=composeVisualSlide(current.body,demo,()=>crypto.randomUUID().replaceAll('-',''))
  if(!body||!encodeSlide({...current,body},index+1,edit.slides.length)){setError('This slide cannot fit another tool. Existing content is unchanged.');return}
  setError('')
  patch({body})
  setTool('Content')
  setStudioTab('Slides')
 }
 function move(delta:number){if(!edit)return;const target=index+delta;if(target<0||target>=edit.slides.length)return;const next=[...edit.slides];[next[index],next[target]]=[next[target],next[index]];changeDeck(next,target)}
 const slide=edit?.slides[index]
 if(history)return <section className={styles.slideFields} aria-label="Presentation versions"><div className={styles.controls}><strong>Version history</strong><button type="button" disabled={exclusiveBusy} onClick={()=>setHistory(null)}>Back to preparation</button></div>{error&&<p role="alert">{error}</p>}<small>Latest version and up to ten earlier saves. Restore creates a separate copy.</small>{history.versions.map(v=><div key={v.revision} className={styles.controls}><span>Version {v.revision} · {v.title} · {v.slideCount} slides</span><button type="button" disabled={exclusiveBusy} onClick={()=>restoreVersion(v.revision)}>Restore as copy</button></div>)}</section>
 if(resourceOpen&&edit)return <LiveResourcePicker classId={null} lessonPlanId={null} schemeLessonId={null} canPresent={!exclusiveBusy&&edit.slides.length<30} onPresent={()=>{}} onPrepare={page=>{if(lock.current||saveLock.current||edit.slides.length>=30)return;changeDeck([...edit.slides,page],edit.slides.length);setResourceOpen(false)}} onClose={()=>setResourceOpen(false)}/>
 if(rehearsing&&edit)return <LiveStudioRehearsal
  slides={edit.slides}
  initialIndex={index}
  onClose={selected=>{setIndex(selected);setStudioTab('Slides');setRehearsing(false)}}
  onSave={()=>void save()}
  onPrepare={()=>void save(true)}
  saveDisabled={busy||saving||!edit.title.trim()}
  prepareLabel={attachToPlan?'Save & attach':'Prepare for Live'}
  status={saving?'Saving…':dirty?'Unsaved changes':'All changes saved'}
  error={saveProblem}
 />
 return <div className={styles.teachingLibrary}>
  {onClose&&<header className={styles.studioHeader}><button type="button" aria-label="Back to Go Live" disabled={exclusiveBusy} onClick={()=>{if(mayReplace())onClose()}}>←</button><div><h1>Live Studio</h1><small>{edit?.title||"Prepare a lesson"}</small></div></header>}
 {printDeck&&<SlidePrintPreview title={printDeck.title} slides={printDeck.slides} onClose={()=>setPrintDeck(null)}/>}
  {onClose&&!edit&&<nav className={styles.studioHomeNav} aria-label="Live Studio navigation">{(['Presentations','Resources','Tools','History'] as const).map(tab=><button type="button" key={tab} aria-pressed={libraryTab===tab} disabled={busy} onClick={()=>{setLibraryTab(tab);setError('')}}>{tab==='Tools'?'Teaching tools':tab}</button>)}</nav>}
  {onClose&&edit&&<button type="button" className={styles.studioBack} disabled={exclusiveBusy} onClick={()=>{if(mayReplace()){setEdit(null);markClean();setSaveProblem('');setLibraryTab('Presentations')}}}>← My presentations</button>}
  {onClose&&!edit&&libraryTab==='Presentations'&&<section className={styles.studioHome} aria-label="Presentations">
    <div className={styles.studioHomeHeading}><div><h2>My presentations</h2><small>Create or continue preparing a lesson.</small></div><button type="button" className={styles.primary} disabled={exclusiveBusy} onClick={()=>create()}>+ New presentation</button><button type="button" disabled={exclusiveBusy} onClick={()=>fileInput.current?.click()}>Import</button></div>
    <label className={styles.studioSearch}>Search presentations<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title"/></label>
    <input ref={fileInput} type="file" accept=".json,application/json,.pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)loadFile(file)}}/>
    <div className={styles.studioCardGrid}>{items.filter(item=>item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(item=><article key={item.id} className={styles.studioMaterialCard}><button type="button" className={styles.studioMaterialOpen} disabled={exclusiveBusy} onClick={()=>open(item)}><span className={styles.studioMaterialArt} aria-hidden="true"><span>▤</span></span><strong>{item.title}</strong><small>{item.slideCount} {item.slideCount===1?'slide':'slides'}</small></button><details className={styles.studioCardMenu}><summary aria-label={'Actions for '+item.title}>⋯</summary><div><button type="button" disabled={exclusiveBusy} onClick={()=>open(item,true)}>{attachToPlan?'Attach to Lesson Plan':'Prepare for live'}</button><button type="button" disabled={exclusiveBusy} onClick={()=>open(item,false,true)}>Duplicate</button><button type="button" disabled={exclusiveBusy} onClick={()=>openHistory(item)}>Versions</button><button type="button" disabled={exclusiveBusy} onClick={()=>{if(!window.confirm('Delete this saved presentation? Shared lesson history remains.'))return;void run(async()=>{await command('materials_delete',null,null,{id:item.id,revision:item.revision});await refresh()})}}>Delete</button></div></details></article>)}</div>
    {!items.length?<p>No saved presentations yet.</p>:!items.some(item=>item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))?<p>No matching presentations.</p>:null}
    <button type="button" className={styles.studioBack} disabled={exclusiveBusy} onClick={()=>void run(refresh)}>Refresh library</button>
  </section>}
  {onClose&&!edit&&libraryTab==='Resources'&&<section className={styles.studioHome}><h2>Teaching resources</h2><p>Choose a presentation to attach textbook pages, photos or PDFs.</p><button className={styles.primary} disabled={exclusiveBusy} onClick={()=>create(false,'Resources')}>+ New presentation</button>{items.map(item=><button key={item.id} disabled={exclusiveBusy} onClick={()=>open(item,false,false,'Resources')}>{item.title}</button>)}</section>}
  {onClose&&!edit&&libraryTab==='Tools'&&<section className={styles.studioHome}><h2>Teaching tools</h2><TeachingToolsLibrary/></section>}
  {onClose&&!edit&&libraryTab==='History'&&<section className={styles.studioHome}><h2>Presentation versions</h2>{items.length?items.map(item=><button key={item.id} disabled={exclusiveBusy} onClick={()=>openHistory(item)}>{item.title} · Version {item.revision}</button>):<p>No saved presentations yet.</p>}</section>}
  {!onClose&&<details className={styles.studioLibraryMenu} open={!edit||undefined}><summary>{edit?"My presentations":"Create or open a presentation"}</summary><div className={styles.controls}><button type="button" disabled={exclusiveBusy} onClick={()=>create()}>New presentation</button>{currentDeck&&<button type="button" disabled={exclusiveBusy} onClick={()=>create(true)}>Save current deck</button>}<button type="button" disabled={exclusiveBusy} onClick={()=>fileInput.current?.click()}>Import presentation</button><input ref={fileInput} type="file" accept=".json,application/json,.pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)loadFile(file)}}/><button type="button" disabled={exclusiveBusy} onClick={()=>void run(refresh)}>Refresh</button></div>
  <div className={styles.materialList}>{items.length===0?<p>No saved presentations</p>:items.map(item=><div key={item.id}><div><strong>{item.title}</strong><small>{item.slideCount} slides</small></div><button disabled={exclusiveBusy} onClick={()=>open(item)}>Edit</button>{onClose&&<button type="button" disabled={exclusiveBusy} onClick={()=>open(item,false,true)}>Duplicate</button>}{onClose&&<button type="button" disabled={exclusiveBusy} onClick={()=>openHistory(item)}>Versions</button>}<button disabled={exclusiveBusy} onClick={()=>open(item,true)}>Use</button><button disabled={exclusiveBusy} onClick={()=>{if(!window.confirm('Delete this saved presentation? Shared lesson history remains.'))return;void run(async()=>{await command('materials_delete',null,null,{id:item.id,revision:item.revision});if(alive.current&&edit?.id===item.id){setEdit(null);markClean()}await refresh()})}}>Delete</button></div>)}</div></details>}
  {error&&<p role="alert">{error}</p>}
  {edit&&slide&&<section className={styles.slideFields} aria-label="Prepare presentation">
   <div className={styles.studioStatus}><small role="status">{saving?"Saving…":dirty?"Draft · Unsaved changes":edit.revision>0?"Draft · All changes saved":"New presentation"}</small>{onClose&&<button type="button" disabled={busy||!edit.slides.some(s=>s.title.trim()||s.body.trim())} onClick={()=>setRehearsing(true)}>Preview</button>}</div>
   {saveProblem&&<div role="alert"><p>{saveProblem.includes('live_material_conflict')?'A newer version exists. Your draft is intact. Save a separate recovered copy or reopen the latest saved version.':saveProblem}</p><button type="button" disabled={exclusiveBusy} onClick={()=>void save()}>Retry save</button>{saveProblem.includes('live_material_conflict')&&<button type="button" disabled={exclusiveBusy} onClick={preserveCopy}>Recover as new copy</button>}</div>}
   <label>Presentation name<input value={edit.title} maxLength={120} disabled={busy} onChange={e=>{if(lock.current)return;const title=e.target.value;setEdit(m=>m?{...m,title}:m);markDirty()}}/></label>
   {onClose&&<nav className={styles.studioTabs} aria-label="Preparation sections">{(["Slides","Resources","Tools","Flow","Notes"] as const).map(tab=><button type="button" key={tab} aria-pressed={studioTab===tab} onClick={()=>setStudioTab(tab)}>{tab}</button>)}</nav>}
   {onClose&&<div className={styles.studioSection} hidden={studioTab!=="Resources"}><><button type="button" disabled={exclusiveBusy||edit.slides.length>=30} onClick={()=>setResourceOpen(true)}>Add approved resource page</button><label>Add private photo or PDF<input aria-label="Add private photo or PDF" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={exclusiveBusy||edit.slides.length>=30} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)attachFile(file)}}/><small>8 MB maximum · private until presented</small></label></></div>}
   {onClose&&studioTab==="Tools"&&<section className={styles.studioSection} aria-label="Prepare interactive tools"><small>Adjust a model and insert it into the selected slide. Other activities are available for private practice.</small><TeachingToolsLibrary onPrepare={prepareDemo} disabled={busy}/></section>}
   {onClose&&<div className={styles.studioSection} hidden={studioTab!=="Flow"}><section aria-label="Lesson flow"><strong>Lesson flow · {edit.slides.reduce((sum,s)=>sum+studioMinutes(s),0)} min planned</strong><ol>{edit.slides.map((step,i)=><li key={i}><button type="button" disabled={busy} aria-current={i===index?'step':undefined} onClick={()=>setIndex(i)}>{step.title||'Untitled stage'} · {studioMinutes(step)||'—'} min</button></li>)}</ol><label>Stage duration (minutes)<select value={studioMinutes(slide)} disabled={busy} onChange={e=>{const notes=setStudioMinutes(slide,Number(e.target.value));if(notes===null)setError('Shorten the private notes before adding a duration.');else patch({notes})}}><option value={0}>Not set</option>{Array.from({length:120},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label>{studioResource(slide)&&<small>Linked certified resource · checked before use.</small>}</section></div>}
   <div className={styles.studioSection} data-studio-editor={!!onClose} hidden={!!onClose&&studioTab!=="Slides"}>
   <div className={styles.studioCanvasArea}>{studioFile(slide)?<StudioFilePreview reference={studioFile(slide)!} title={slide.title}/>:<SlideCanvas slide={slide} number={index+1} total={edit.slides.length} ownerPhotoPreview/>}</div>
   <div className={styles.slideToolbar}><button type="button" aria-label="Previous slide" disabled={busy||index===0} onClick={()=>setIndex(i=>i-1)}>‹</button><span>Slide {index+1} of {edit.slides.length}</span><button type="button" aria-label="Next slide" disabled={busy||index===edit.slides.length-1} onClick={()=>setIndex(i=>i+1)}>›</button><button disabled={busy||edit.slides.length>=30} onClick={()=>{setEdit(m=>m?{...m,slides:[...m.slides,blank()]}:m);setIndex(edit.slides.length);markDirty()}}>+ Slide</button><button disabled={busy||edit.slides.length<=1} onClick={()=>{setEdit(m=>m?{...m,slides:m.slides.filter((_,i)=>i!==index)}:m);setIndex(i=>Math.max(0,i-1));markDirty()}}>Delete slide</button></div>
   <nav aria-label="Presentation thumbnails" className={styles.studioThumbRail}>{edit.slides.map((item,i)=><button type="button" key={i} disabled={busy} aria-pressed={i===index} aria-label={'Slide '+(i+1)+': '+item.title} style={{flex:'0 0 110px',border:i===index?'2px solid #087e72':'1px solid #92b5a8',padding:3,background:'#fff'}} draggable={!busy} onDragStart={e=>{dragSlide.current=i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i))}} onDragEnd={()=>{dragSlide.current=null}} onDragOver={e=>{if(dragSlide.current!==null&&!busy){e.preventDefault();e.dataTransfer.dropEffect='move'}}} onDrop={e=>{e.preventDefault();const from=dragSlide.current;dragSlide.current=null;if(from===null||from===i||busy||from<0||from>=edit.slides.length)return;const reordered=[...edit.slides];const [moved]=reordered.splice(from,1);reordered.splice(i,0,moved);changeDeck(reordered,i)}} onClick={()=>setIndex(i)}><SlideCanvas slide={item} number={i+1} total={edit.slides.length} mini ownerPhotoPreview/></button>)}</nav>
   <div className={styles.studioTools}><button type="button" aria-pressed={tool==="Content"} onClick={()=>setTool(tool==="Content"?null:"Content")}>Text / objects / quiz</button>{onClose&&<button type="button" onClick={()=>setStudioTab("Resources")}>Photo / PDF</button>}<button type="button" aria-pressed={tool==="Theme"} onClick={()=>setTool(tool==="Theme"?null:"Theme")}>Theme</button></div>
   <details className={styles.studioLibraryMenu}><summary>Slide actions</summary><div className={styles.slideToolbar}><button type="button" disabled={busy||index===0} onClick={()=>move(-1)}>Move left</button><button type="button" disabled={busy||index===edit.slides.length-1} onClick={()=>move(1)}>Move right</button><button type="button" disabled={busy||edit.slides.length>=30} onClick={()=>changeDeck([...edit.slides.slice(0,index+1),{...slide},...edit.slides.slice(index+1)],index+1)}>Duplicate slide</button><button type="button" disabled={busy||buildTextRevealSlides(slide,31-edit.slides.length).length===0} onClick={()=>{const steps=buildTextRevealSlides(slide,31-edit.slides.length);if(steps.length&&window.confirm('Replace this slide with '+steps.length+' progressive teaching steps?'))changeDeck([...edit.slides.slice(0,index),...steps,...edit.slides.slice(index+1)],index)}}>Build reveal steps</button></div></details>
   <div className={styles.studioSection} hidden={!!onClose&&tool!=="Content"}>
   <label>Quick template<select value="" disabled={busy} onChange={e=>{const value=e.target.value;if(!value)return;if((slide.title||slide.body)&&!window.confirm('Replace slide text with this template?'))return;const templates:Record<string,Partial<LiveSlide>>={goal:{title:'Learning goal',body:'By the end of this lesson, you will be able to…'},example:{title:'Worked example',body:'Problem:\nStep 1:\nStep 2:\nAnswer:'},question:{title:'Try it',body:'Question:\nThink about your answer.'},summary:{title:'Remember',body:'Key idea:\nExample:'}};patch(templates[value]??{})}}><option value="">Choose a template</option><option value="goal">Learning goal</option><option value="example">Worked example</option><option value="question">Question</option><option value="summary">Summary</option></select></label>
   <label>Slide title<input disabled={busy} value={slide.title} maxLength={120} onChange={e=>patch({title:e.target.value})}/></label>
   <SlideBodyEditor key={edit.id+':'+index} slide={slide} disabled={busy} onChange={body=>patch({body})}/>
   </div>
   <div className={styles.studioSection} hidden={!!onClose&&tool!=="Theme"}>
   <div className={styles.slideOptions}>
    <label>Diagram<select aria-label="Diagram" disabled={busy} value={slide.diagram??'none'} onChange={e=>patch({diagram:e.target.value as SlideDiagram})}>{SLIDE_DIAGRAMS.map(d=><option key={d} value={d}>{diagramLabel(d)}</option>)}</select></label>
    <label>Theme<select aria-label="Theme" disabled={busy} value={slide.theme??'paper'} onChange={e=>patch({theme:e.target.value as SlideTheme})}>{SLIDE_THEMES.map(t=><option key={t}>{t}</option>)}</select></label>
    <label>Layout<select aria-label="Layout" disabled={busy} value={slide.layout??'wide'} onChange={e=>patch({layout:e.target.value==='portrait'?'portrait':'wide'})}><option value="wide">Wide</option><option value="portrait">Portrait</option></select></label>
    <label>Text size<select aria-label="Text size" disabled={busy} value={slide.font??'normal'} onChange={e=>patch({font:e.target.value==='large'?'large':'normal'})}><option value="normal">Normal</option><option value="large">Large</option></select></label>
   </div>
   </div>
   </div>
   <div className={styles.studioSection} hidden={!!onClose&&studioTab!=="Notes"}>
   <PrivateSlideFields key={edit.id+':private:'+index} slide={slide} disabled={busy} onChange={notes=>patch({notes})}/>
   </div>
   <div className={styles.studioFooter}>{onClose&&<button type="button" disabled={exclusiveBusy||!edit.slides.some(s=>s.title.trim()||s.body.trim())} onClick={()=>setRehearsing(true)}>Rehearse</button>}<button className={styles.primary} disabled={exclusiveBusy||!edit.title.trim()} onClick={()=>void save(true)}>{attachToPlan?"Save & attach":onClose?"Prepare for Live":"Save & use"}</button></div>
   <details className={styles.studioLibraryMenu}><summary>Presentation options</summary><label className={styles.autoSaveLabel}><input type="checkbox" checked={autoSave} disabled={exclusiveBusy} onChange={e=>setAutoSave(e.target.checked)}/> Auto-save</label><div className={styles.controls}><button disabled={exclusiveBusy||!edit.title.trim()} onClick={()=>void save()}>Save presentation</button><button disabled={exclusiveBusy} onClick={()=>{if(mayReplace()){setEdit(null);markClean();setSaveProblem('')}}}>Close editor</button><button type="button" disabled={exclusiveBusy||!edit.title.trim()} onClick={download} >Export slides (without private notes)</button><button type="button" disabled={exclusiveBusy||!edit.title.trim()||edit.slides.some(s=>isPhotoBody(s.body))} onClick={()=>setPrintDeck(edit)}>Print / Save PDF</button><button type="button" disabled={exclusiveBusy||!edit.title.trim()} onClick={downloadPowerPoint}>Export PowerPoint text</button><small>{saving?'Saving…':dirty?'Changes not yet saved':edit.revision>0?'Saved privately · recover from My Presentations':'New presentation'}</small></div></details>
  </section>}
 </div>
}
