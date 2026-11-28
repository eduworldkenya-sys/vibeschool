'use client'
import {useEffect,useState,useRef} from 'react'
import {X} from 'lucide-react'
import {LiveResourcePicker} from './LiveResourcePicker'
import {SlideCanvas,validSlide,type LiveSlide} from './LiveSlideCanvas'
import {StudioFilePreview,uploadStudioFile} from './LiveStudioFiles'
import {setStudioFile,studioFile} from './LiveSlideProtocol'
import {importPresentationFile} from './LivePresentationImport'
import styles from './LiveClassroom.module.css'

export type ContentTab='lesson'|'resources'|'presentations'|'uploads'
type Command=(action:string,id?:string|null,version?:number|null,payload?:Record<string,unknown>)=>Promise<unknown>
type Summary={id:string;title:string;slideCount:number}
const tabs:[ContentTab,string][]=[['lesson','From this lesson'],['resources','Browse resources'],['presentations','My presentations'],['uploads','Upload files']]
export function LiveContentDrawer({tab,onTab,onClose,classId,lessonPlanId,schemeLessonId,roomId,command,canAdd,canShow,onAdd,onAddDeck,onShow,onShowText,onManagePresentations}:{
 tab:ContentTab;onTab:(tab:ContentTab)=>void;onClose:()=>void;classId:string|null;lessonPlanId:string|null;schemeLessonId:string|null;roomId:string;command:Command;canAdd:boolean;canShow:boolean;onAdd:(slide:LiveSlide)=>void;onAddDeck:(slides:LiveSlide[])=>void;onShow:(slide:LiveSlide)=>Promise<void>;onShowText:(body:string)=>void;onManagePresentations:()=>void
}){
 const [decks,setDecks]=useState<Summary[]>([]),[deck,setDeck]=useState<LiveSlide[]>([]),[index,setIndex]=useState(0),[search,setSearch]=useState(''),[uploadDeck,setUploadDeck]=useState<LiveSlide[]>([]),[uploadIndex,setUploadIndex]=useState(0),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[failure,setFailure]=useState('')
 const alive=useRef(true),lock=useRef(false),request=useRef(0)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current++}},[])
 useEffect(()=>{if(tab!=='presentations')return;let active=true;setFailure('');void command('materials_list').then(value=>{const list=(value as {materials?:Summary[]}).materials;if(!Array.isArray(list))throw Error('Could not load presentations.');if(active)setDecks(list.filter(item=>typeof item.id==='string'&&typeof item.title==='string'&&Number.isInteger(item.slideCount)))}).catch(()=>{if(active)setFailure('Could not load saved presentations. Reopen this tab to retry.')});return()=>{active=false}},[tab,command])
 async function run(job:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setFailure('');setFeedback('');try{await job()}catch(e){if(alive.current)setFailure(e instanceof Error?e.message:'Content could not be prepared.')}finally{lock.current=false;if(alive.current)setBusy(false)}}
 function open(id:string){const token=++request.current;void run(async()=>{const value=await command('materials_get',null,null,{id}) as {id?:string;slides?:LiveSlide[]};if(value.id!==id||!Array.isArray(value.slides)||value.slides.length===0||value.slides.length>30||!value.slides.every(validSlide))throw Error('Saved presentation is unavailable.');if(alive.current&&token===request.current){setDeck(value.slides);setIndex(0)}})}
 function upload(source:File){void run(async()=>{const ref=await uploadStudioFile(source);const item:LiveSlide={title:source.name.replace(/\.[^.]+$/,'').trim().slice(0,120)||'Prepared file',body:'Prepared teaching file'};const notes=setStudioFile(item,ref);if(!notes)throw Error('Could not attach this file.');if(alive.current){setUploadDeck([{...item,notes}]);setUploadIndex(0)}})}
 function importPresentation(source:File){
   void run(async()=>{
     const imported=await importPresentationFile(source)
     if(alive.current){setUploadDeck(imported.slides);setUploadIndex(0)}
   })
 }
 const previewDeck=tab==='presentations'?deck:tab==='uploads'?uploadDeck:[]
 const previewIndex=tab==='uploads'?uploadIndex:index
 const setPreviewIndex=tab==='uploads'?setUploadIndex:setIndex
 const selected=previewDeck[previewIndex]
 return <aside className={styles.contentDrawer} aria-label="Add content">
  <header className={styles.contentDrawerHeader}><div><strong>Add content</strong><small>Browse privately while the lesson continues.</small></div><button type="button" aria-label="Close content drawer" disabled={busy} onClick={onClose}><X size={19}/></button></header>
  <nav className={styles.contentTabs} aria-label="Content sources">{tabs.map(([value,label])=><button type="button" key={value} disabled={busy} aria-pressed={tab===value} onClick={()=>{setFailure('');setFeedback('');onTab(value)}}>{label}</button>)}</nav>
  <div className={styles.contentDrawerBody}>
  {(tab==='lesson'||tab==='resources')&&<LiveResourcePicker key={tab} classId={classId} lessonPlanId={lessonPlanId} schemeLessonId={schemeLessonId} linkedOnly={tab==='lesson'} dualActions canPrepare={canAdd} canPresent={canShow} onPrepare={slide=>onAdd(slide)} onPresent={onShowText} onClose={onClose}/>}
  {tab==='presentations'&&<><label>Search presentations<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Presentation title"/></label><div className={styles.contentResults}>{decks.filter(item=>item.title.toLowerCase().includes(search.trim().toLowerCase())).map(item=><button type="button" key={item.id} disabled={busy} onClick={()=>open(item.id)}><strong>{item.title}</strong><small>{item.slideCount} slides</small></button>)}</div>{!decks.length&&<p>No saved presentations available.</p>}<button type="button" disabled={busy} onClick={onManagePresentations}>Manage presentations</button></>}
  {tab==='uploads'&&<>
    <label>Import editable slides<input type="file" accept=".json,.pptx,.pdf" disabled={busy} onChange={e=>{const source=e.target.files?.[0];e.target.value='';if(source)importPresentation(source)}}/><small>VibeSchool JSON, PowerPoint text or PDF text</small></label>
    <label>Upload original PDF or photo<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const source=e.target.files?.[0];e.target.value='';if(source)upload(source)}}/><small>Private upload · 8 MB maximum</small></label>
  </>}
  {selected&&<section className={styles.contentSelection} aria-label="Private content preview">
    {studioFile(selected)?<StudioFilePreview reference={studioFile(selected)!} title={selected.title}/>:<SlideCanvas slide={selected} number={previewIndex+1} total={previewDeck.length} roomId={roomId} ownerPhotoPreview/>}
    {previewDeck.length>1&&<div className={styles.contentActions}>
      <button type="button" disabled={busy||previewIndex===0} onClick={()=>setPreviewIndex(i=>i-1)}>Previous</button>
      <span>{previewIndex+1} / {previewDeck.length}</span>
      <button type="button" disabled={busy||previewIndex>=previewDeck.length-1} onClick={()=>setPreviewIndex(i=>i+1)}>Next</button>
    </div>}
    <div className={styles.contentActions}>
      <button type="button" disabled={busy||!canAdd} onClick={()=>onAdd(selected)}>Add to lesson</button>
      {previewDeck.length>1&&<button type="button" disabled={busy||!canAdd} onClick={()=>onAddDeck(previewDeck)}>Add all {previewDeck.length} slides</button>}
      <button type="button" className={styles.primary} disabled={busy||!canShow} onClick={()=>void run(async()=>{await onShow(selected);if(alive.current)setFeedback('Shown to class.')})}>Show to class</button>
    </div>
  </section>}
  {failure&&<p role="alert">{failure}</p>}{feedback&&<p role="status">{feedback}</p>}
  </div>
 </aside>
}
