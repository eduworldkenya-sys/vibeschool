'use client'
import {useEffect,useState,useRef} from 'react'
import {SlideCanvas,validSlide,diagramLabel,SLIDE_DIAGRAMS,SLIDE_THEMES,type LiveSlide,type SlideDiagram,type SlideTheme} from './LiveSlideCanvas'
import styles from './LiveClassroom.module.css'
import {SlideBodyEditor} from './LiveSlideBodyEditor'
import {exportDeck,importDeck,MAX_DECK_FILE_BYTES,buildTextRevealSlides,isPhotoBody} from './LiveSlideProtocol'
type Summary={id:string;title:string;revision:number;slideCount:number;updatedAt:string}
type Material={id:string;title:string;revision:number;slides:LiveSlide[]}
type Command=(action:string,id?:string|null,version?:number|null,payload?:Record<string,unknown>)=>Promise<unknown>
const blank=()=>({title:'',body:''})
function isMaterial(v:unknown):v is Material{
 if(!v||typeof v!=='object')return false
 const m=v as Material
 return typeof m.id==='string'&&typeof m.title==='string'&&Number.isInteger(m.revision)&&m.revision>0&&Array.isArray(m.slides)&&m.slides.length>0&&m.slides.length<=30&&m.slides.every(validSlide)
}
export function TeachingLibrary({command,currentDeck,onUse}:{command:Command;currentDeck:LiveSlide[]|null;onUse:(m:Material)=>void}){
 const [items,setItems]=useState<Summary[]>([]),[edit,setEdit]=useState<Material|null>(null),[index,setIndex]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false)
 const alive=useRef(false),lock=useRef(false),fileInput=useRef<HTMLInputElement>(null)
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
 function mayReplace(){return !dirty||window.confirm('Discard unsaved changes to this presentation?')}
 function create(fromCurrent=false){
  if(!mayReplace())return
  const slides=fromCurrent&&currentDeck?currentDeck.map(s=>({...s})):[blank()]
  setEdit({id:crypto.randomUUID(),title:fromCurrent?(slides[0]?.title||'Untitled presentation'):'',revision:0,slides});setIndex(0);setDirty(true)
 }
 function open(item:Summary,use=false){
  if(!mayReplace())return
  void run(async()=>{const result=await command('materials_get',null,null,{id:item.id})
   if(!isMaterial(result))throw Error('Invalid presentation response')
   if(!alive.current)return
   if(use){onUse(result);return}
   setEdit(result);setIndex(0);setDirty(false)
  })
 }
 function patch(p:Partial<LiveSlide>){
  setEdit(m=>m?{...m,slides:m.slides.map((s,i)=>i===index?{...s,...p}:s)}:m);setDirty(true)
 }
 function save(use=false){
  if(!edit||!edit.title.trim())return
  if(edit.slides.some(s=>isPhotoBody(s.body))){setError('Remove room-specific photo slides before saving a reusable presentation.');return}
  void run(async()=>{const result=await command('materials_save',null,null,{id:edit.id,revision:edit.revision,title:edit.title,slides:edit.slides})
   if(!isMaterial(result))throw Error('Invalid save response')
   if(!alive.current)return
   setEdit(result);setDirty(false);await refresh();if(alive.current&&use)onUse(result)
  })
 }
 function download(){
  if(!edit||busy)return
  setError('')
  try{const content=exportDeck(edit.title,edit.slides);const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));try{const link=document.createElement('a');link.href=url;link.download='vibeschool-presentation.json';document.body.appendChild(link);try{link.click()}finally{link.remove()}}finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000)}}catch(e){setError(e instanceof Error?e.message:'Could not export presentation.')}
 }
 function loadFile(file:File){
  if(busy||lock.current||!mayReplace())return
  void run(async()=>{if(file.size>MAX_DECK_FILE_BYTES)throw Error('Presentation file is too large.');const deck=importDeck(await file.text());if(!alive.current)return;setEdit({id:crypto.randomUUID(),title:deck.title,slides:deck.slides,revision:0});setIndex(0);setDirty(true)})
 }
 function changeDeck(slides:LiveSlide[],nextIndex:number){setEdit(m=>m?{...m,slides}:m);setIndex(nextIndex);setDirty(true)}
 function move(delta:number){if(!edit)return;const target=index+delta;if(target<0||target>=edit.slides.length)return;const next=[...edit.slides];[next[index],next[target]]=[next[target],next[index]];changeDeck(next,target)}
 const slide=edit?.slides[index]
 return <div className={styles.teachingLibrary}>
  <div className={styles.controls}><button type="button" disabled={busy} onClick={()=>create()}>New presentation</button>{currentDeck&&<button type="button" disabled={busy} onClick={()=>create(true)}>Save current deck</button>}<button type="button" disabled={busy} onClick={()=>fileInput.current?.click()}>Import slides</button><input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)loadFile(file)}}/><button type="button" disabled={busy} onClick={()=>void run(refresh)}>Refresh</button></div>
  {error&&<p role="alert">{error}</p>}
  <div className={styles.materialList}>{items.length===0?<p>No saved presentations</p>:items.map(item=><div key={item.id}><div><strong>{item.title}</strong><small>{item.slideCount} slides</small></div><button disabled={busy} onClick={()=>open(item)}>Edit</button><button disabled={busy} onClick={()=>open(item,true)}>Use</button><button disabled={busy} onClick={()=>{if(!window.confirm('Delete this saved presentation? Shared lesson history remains.'))return;void run(async()=>{await command('materials_delete',null,null,{id:item.id,revision:item.revision});if(alive.current&&edit?.id===item.id){setEdit(null);setDirty(false)}await refresh()})}}>Delete</button></div>)}</div>
  {edit&&slide&&<section className={styles.slideFields} aria-label="Prepare presentation">
   <label>Presentation name<input value={edit.title} maxLength={120} disabled={busy} onChange={e=>{setEdit({...edit,title:e.target.value});setDirty(true)}}/></label>
   <SlideCanvas slide={slide} number={index+1} total={edit.slides.length}/>
   <nav aria-label="Presentation thumbnails" style={{display:'flex',gap:8,overflowX:'auto',padding:4}}>{edit.slides.map((item,i)=><button type="button" key={i} disabled={busy} aria-pressed={i===index} aria-label={'Slide '+(i+1)+': '+item.title} style={{flex:'0 0 110px',border:i===index?'2px solid #087e72':'1px solid #92b5a8',padding:3,background:'#fff'}} onClick={()=>setIndex(i)}><SlideCanvas slide={item} number={i+1} total={edit.slides.length} mini/></button>)}</nav>
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
   <label>Presenter notes (private)<textarea maxLength={2000} disabled={busy} value={slide.notes??''} onChange={e=>patch({notes:e.target.value})}/></label>
   <div className={styles.controls}><button className={styles.primary} disabled={busy||!edit.title.trim()} onClick={()=>save()}>Save presentation</button><button disabled={busy||!edit.title.trim()} onClick={()=>save(true)}>Save & use</button><button disabled={busy} onClick={()=>{if(mayReplace()){setEdit(null);setDirty(false)}}}>Close editor</button><button type="button" disabled={busy||!edit.title.trim()} onClick={download}>Export slides (without private notes)</button><small>{dirty?'Unsaved changes':'Saved privately'}</small></div>
  </section>}
 </div>
}
