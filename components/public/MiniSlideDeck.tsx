'use client'
import {useRef,useState} from 'react'
import {SlideCanvas} from '@/components/live-classroom/LiveSlideCanvas'
import {SlideBodyEditor} from '@/components/live-classroom/LiveSlideBodyEditor'
import {SLIDE_DIAGRAMS,SLIDE_THEMES,diagramLabel,decodeAssessment,prepareAssessment,preparedAssessment,importDeck,buildTextRevealSlides,type LiveSlide,type SlideTheme,type SlideDiagram} from '@/components/live-classroom/LiveSlideProtocol'
import {buildMiniDeck,parseMiniDeck,MINI_SLIDE_LIMIT} from '@/lib/minis/slides'
export const blankMiniSlide=():LiveSlide=>({title:'',body:'',theme:'paper',layout:'portrait'})
export function MiniSlideCover({value}:{value:unknown}){
 const deck=parseMiniDeck(value)
 return deck?<div aria-hidden="true"><SlideCanvas slide={deck[0].slide} number={1} total={deck.length} mini/><small>Slides · {deck.length}</small></div>:null
}
export function MiniSlideReader({value}:{value:unknown}){
 const deck=parseMiniDeck(value)
 const [index,setIndex]=useState(0),[answers,setAnswers]=useState<Record<number,number>>({}),[full,setFull]=useState(false)
 const gesture=useRef<{x:number;y:number;id:number}|null>(null)
 if(!deck)return <p role="status">Slides unavailable.</p>
 const page=Math.min(index,deck.length-1),{slide,answer}=deck[page],q=decodeAssessment(slide.body),selected=answers[page]
 const move=(delta:number)=>setIndex(i=>Math.max(0,Math.min(deck.length-1,i+delta)))
 return <section aria-label="Mini Lesson slides" style={full?{position:'fixed',inset:0,zIndex:1000,background:'Canvas',color:'CanvasText',overflow:'auto',padding:16}:undefined}>
 <div tabIndex={0} aria-label="Swipe or use arrow keys to change slides" style={{touchAction:'pan-y'}}
 onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();move(e.key==='ArrowRight'?1:-1)}}}
 onPointerDown={e=>{gesture.current=null;if(e.isPrimary&&e.pointerType==='touch'&&!(e.target instanceof Element&&e.target.closest('button,a,input,select,textarea,[role="slider"],[role="button"],[contenteditable],svg')))gesture.current={x:e.clientX,y:e.clientY,id:e.pointerId}}}
 onPointerCancel={()=>{gesture.current=null}}
 onPointerUp={e=>{const g=gesture.current;gesture.current=null;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1)}}>
 {q?<section aria-label="Slide question" style={{padding:20}}><h2>{slide.title}</h2><p>{q.question}</p><fieldset><legend>Choose an answer</legend>{q.options.map((option,i)=><button type="button" key={i} aria-pressed={selected===i} onClick={()=>setAnswers(prev=>({...prev,[page]:i}))}>{option}</button>)}</fieldset>{selected!==undefined&&<p role="status">{answer?(selected===answer.option?'Correct! '+answer.explanation:'Try again.'):'Response selected.'}</p>}</section>:<SlideCanvas key={page} slide={slide} number={page+1} total={deck.length} explore/>}
 </div><nav aria-label="Slide navigation" style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><button type="button" disabled={page===0} onClick={()=>move(-1)}>Previous</button><span aria-live="polite">{page+1} / {deck.length}</span><button type="button" disabled={page===deck.length-1} onClick={()=>move(1)}>Next</button><button type="button" onClick={()=>setFull(v=>!v)}>{full?'Exit full screen':'Full screen'}</button></nav></section>
}
export function MiniSlideEditor({slides,onChange,disabled}:{slides:LiveSlide[];onChange:(s:LiveSlide[])=>void;disabled:boolean}){
 const [index,setIndex]=useState(0),[error,setError]=useState('')
 const page=Math.min(index,slides.length-1),slide=slides[page],q=decodeAssessment(slide.body),a=preparedAssessment(slide)
 const patch=(p:Partial<LiveSlide>)=>onChange(slides.map((s,i)=>i===page?{...s,...p}:s))
 const move=(d:number)=>{const n=page+d;if(n<0||n>=slides.length)return;const copy=[...slides];[copy[page],copy[n]]=[copy[n],copy[page]];onChange(copy);setIndex(n)}
 return <section aria-label="Slide editor">
 <label>Theme<select value={slide.theme??'paper'} disabled={disabled} onChange={e=>onChange(slides.map(s=>({...s,theme:e.target.value as SlideTheme})))}>{SLIDE_THEMES.map(t=><option key={t}>{t}</option>)}</select></label>
 <nav aria-label="Choose slide">{slides.map((_,i)=><button type="button" key={i} aria-pressed={i===page} onClick={()=>setIndex(i)}>{i+1}</button>)}</nav>
 <label>Slide title<input maxLength={120} value={slide.title} disabled={disabled} onChange={e=>patch({title:e.target.value})}/></label>
 <label>Diagram<select value={slide.diagram??'none'} disabled={disabled} onChange={e=>patch({diagram:e.target.value as SlideDiagram})}>{SLIDE_DIAGRAMS.map(d=><option key={d} value={d}>{diagramLabel(d)}</option>)}</select></label>
 <SlideBodyEditor key={page} slide={slide} disabled={disabled} allowVisual={false} onChange={body=>patch({body})}/>
 {q?.kind==='quiz'&&<div><label>Correct answer<select value={a?.option??''} disabled={disabled} onChange={e=>{const notes=prepareAssessment(slide,e.target.value===''?null:Number(e.target.value),a?.explanation??'');if(notes!==null)patch({notes})}}><option value="">Choose answer</option>{q.options.map((o,i)=><option key={i} value={i}>{o}</option>)}</select></label>{a&&<label>Explanation<textarea maxLength={800} value={a.explanation} disabled={disabled} onChange={e=>{const notes=prepareAssessment(slide,a.option,e.target.value);if(notes!==null)patch({notes})}}/></label>}</div>}
 <button type="button" disabled={disabled||slides.length>=MINI_SLIDE_LIMIT} onClick={()=>{onChange([...slides,{...blankMiniSlide(),theme:slide.theme}]);setIndex(slides.length)}}>Add slide</button>
 <button type="button" disabled={disabled||slides.length>=MINI_SLIDE_LIMIT} onClick={()=>{onChange([...slides.slice(0,page+1),{...slide},...slides.slice(page+1)]);setIndex(page+1)}}>Duplicate</button>
 <button type="button" disabled={disabled||slides.length<=2} onClick={()=>{onChange(slides.filter((_,i)=>i!==page));setIndex(Math.max(0,page-1))}}>Delete</button>
 <button type="button" disabled={disabled||page===0} onClick={()=>move(-1)}>Move earlier</button><button type="button" disabled={disabled||page===slides.length-1} onClick={()=>move(1)}>Move later</button>
 <button type="button" disabled={disabled} onClick={()=>{const steps=buildTextRevealSlides(slide,MINI_SLIDE_LIMIT-slides.length+1);if(!steps.length){setError('Use separate lines of text.');return}onChange([...slides.slice(0,page),...steps,...slides.slice(page+1)]);setError('')}}>Reveal steps</button>
 <label>Import VibeSchool slides<input type="file" accept=".json,application/json" disabled={disabled} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>512000)throw Error('Presentation too large.');const imported=importDeck(await file.text());buildMiniDeck(imported.slides);onChange(imported.slides);setIndex(0);setError('')}catch(err){setError(err instanceof Error?err.message:'Unable to import.')}}}/></label>{error&&<p role="alert">{error}</p>}</section>
}
