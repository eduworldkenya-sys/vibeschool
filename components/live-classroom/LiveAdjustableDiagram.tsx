'use client'
import {useRef,useState,type PointerEvent} from 'react'
import {changeDemo,DEMO_RANGES,diagramLabel,type SlideDemo} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'
import {ScienceSimulation} from './LiveScienceSimulation'
import {simulationSummary} from './LiveSimulationModel'
import {TeachingToolDrawing} from './TeachingToolDrawing'
import {teachingToolModel} from './TeachingToolModels.mjs'
const ink='#183a56',blue='#2466a4',fill='#70b9ea'
function point(angle:number,r:number){const a=angle*Math.PI/180;return [160+r*Math.sin(a),88-r*Math.cos(a)]}
export function DemoDrawing({demo,onChange}:{demo:SlideDemo;onChange?:(d:SlideDemo)=>void}){
 const {kind,a,b}=demo
 const drag=useRef<'a'|'b'|null>(null)
 const draggable=Boolean(onChange)&&(kind==='ruler'||kind==='number-line'||kind==='protractor'||kind==='clock')
 const model=teachingToolModel(kind)
 const description=model?.summary(a,b)??simulationSummary(demo)??(kind==='clock'?a+':'+String(b).padStart(2,'0'):kind.startsWith('fraction-')?a+'/'+b:kind==='protractor'?a+' degrees':kind==='coordinate-grid'?'('+a+', '+b+')':kind==='ruler'?a+' to '+b+' cm, distance '+Math.abs(b-a)+' cm':a+' to '+b+', change '+(b-a))
 function move(event:PointerEvent<SVGSVGElement>){
  const svg=event.currentTarget
  const matrix=svg.getScreenCTM()
  if(!matrix||!onChange)return
  const {x,y}=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse())
  if(event.type==='pointerdown'){
   if(!event.isPrimary||event.button!==0)return
   if(kind==='ruler'||kind==='number-line'){
    if(y<46||y>110)return
    const marker=(n:number)=>kind==='ruler'?20+n*28:160+n*14
    drag.current=Math.abs(x-marker(a))<Math.abs(x-marker(b))?'a':'b'
   }else{
    const radius=Math.hypot(x-160,y-(kind==='clock'?88:148))
    if(radius<12||radius>(kind==='clock'?78:136))return
    drag.current=kind==='clock'?'b':'a'
   }
   svg.setPointerCapture(event.pointerId)
  }
  if(!drag.current||!svg.hasPointerCapture(event.pointerId))return
  if(kind==='ruler')onChange(changeDemo(demo,drag.current,(x-20)/28))
  if(kind==='number-line')onChange(changeDemo(demo,drag.current,(x-160)/14))
  if(kind==='protractor')onChange(changeDemo(demo,'a',Math.atan2(Math.max(0,148-y),x-160)*180/Math.PI))
  if(kind==='clock'){
   const angle=Math.atan2(x-160,88-y)*180/Math.PI
   onChange(changeDemo(demo,'b',(Math.round(angle/6)+60)%60))
  }
 }
 return <svg onPointerDown={draggable?move:undefined} onPointerMove={draggable?move:undefined} onLostPointerCapture={()=>{drag.current=null}} data-draggable={draggable||undefined} className={styles.slideDiagram} viewBox="0 0 320 180" role="img" aria-label={diagramLabel(kind)+': '+description}>
 <rect width="320" height="180" fill="#fff"/><ScienceSimulation demo={demo}/><TeachingToolDrawing demo={demo}/>
 {kind==='clock'&&<><circle cx="160" cy="88" r="72" fill="white" stroke={blue} strokeWidth="2"/>{Array.from({length:12},(_,i)=>{const [x,y]=point(i*30,57);return <text key={i} x={x} y={y+4} textAnchor="middle" fontSize="13" fill={ink}>{i||12}</text>})}{[[a*30+b*.5,36,5],[b*6,53,3]].map(([angle,r,w],i)=>{const [x,y]=point(angle,r);return <line key={i} x1="160" y1="88" x2={x} y2={y} stroke={ink} strokeWidth={w} strokeLinecap="round"/>})}<circle cx="160" cy="88" r="4" fill={ink}/><text x="160" y="176" textAnchor="middle" fill={ink}>{description}</text></>}
 {kind==='fraction-circle'&&<>{Array.from({length:b},(_,i)=>{const [x1,y1]=point(i*360/b,62),[x2,y2]=point((i+1)*360/b,62);return b===1?<circle key={i} cx="160" cy="88" r="62" fill={a?fill:'white'} stroke={blue}/>:<path key={i} d={`M160 88L${x1} ${y1}A62 62 0 ${360/b>180?1:0} 1 ${x2} ${y2}Z`} fill={i<a?fill:'white'} stroke={blue} strokeWidth="1.5"/>})}<text x="160" y="169" textAnchor="middle" fill={ink}>{description}</text></>}
 {kind==='fraction-bars'&&<>{Array.from({length:b},(_,i)=><rect key={i} x={20+i*280/b} y="50" width={280/b} height="65" fill={i<a?fill:'white'} stroke={blue}/>)}<text x="160" y="147" textAnchor="middle" fill={ink}>{description}</text></>}
 {(kind==='number-line'||kind==='ruler')&&<>{kind==='ruler'&&<rect x="15" y="51" width="290" height="65" rx="3" fill="#fff4bd" stroke={ink}/>}<line x1="20" y1="80" x2="300" y2="80" stroke={ink} strokeWidth="2"/>{Array.from({length:kind==='ruler'?11:21},(_,i)=>{const n=kind==='ruler'?i:i-10,x=20+i*(kind==='ruler'?28:14);return <g key={i}><line x1={x} y1="76" x2={x} y2="87" stroke={ink}/>{(kind==='ruler'||n%2===0)&&<text x={x} y="103" fontSize="10" textAnchor="middle" fill={ink}>{n}</text>}</g>})}{[a,b].map((n,i)=><circle key={i} cx={kind==='ruler'?20+n*28:160+n*14} cy="80" r="5" fill={i?'#ba4532':blue}/>)}<line x1={kind==='ruler'?20+a*28:160+a*14} x2={kind==='ruler'?20+b*28:160+b*14} y1="65" y2="65" stroke={blue} strokeWidth="3"/><text x="160" y="145" textAnchor="middle" fill={ink}>{description}</text></>}
 {kind==='coordinate-grid'&&<>{Array.from({length:9},(_,i)=><g key={i} stroke="#c5d6e3"><line x1={96+i*16} x2={96+i*16} y1="24" y2="152"/><line x1="96" x2="224" y1={24+i*16} y2={24+i*16}/></g>)}<path d="M90 88H230M160 18V158" stroke={ink} strokeWidth="2"/><text x="232" y="84" fill={ink}>x</text><text x="164" y="18" fill={ink}>y</text><circle cx={160+a*16} cy={88-b*16} r="5" fill={blue}/><text x="160" y="174" textAnchor="middle" fill={ink}>{description}</text></>}
 {kind==='protractor'&&<><path d="M30 148 A130 130 0 0 1 290 148Z" fill="#e8f4fb" stroke={blue}/>{Array.from({length:19},(_,i)=>{const t=i*Math.PI/18;return <g key={i}><line x1={160+130*Math.cos(t)} y1={148-130*Math.sin(t)} x2={160+115*Math.cos(t)} y2={148-115*Math.sin(t)} stroke={ink}/><text x={160+100*Math.cos(t)} y={152-100*Math.sin(t)} fontSize="9" textAnchor="middle" fill={ink}>{i*10}</text></g>})}<path d={`M280 148H160L${160+120*Math.cos(a*Math.PI/180)} ${148-120*Math.sin(a*Math.PI/180)}`} stroke="#ba4532" strokeWidth="3" fill="none"/><text x="160" y="174" fill={ink} textAnchor="middle">{description}</text></>}
 </svg>
}
export function DemoControls({demo,onChange,disabled=false}:{demo:SlideDemo;onChange:(d:SlideDemo)=>void;disabled?:boolean}){
 const r=DEMO_RANGES[demo.kind]
 return <div className={styles.demoControls}>{(['a','b'] as const).map((field,i)=>{
  const [min,max]=r[field]
  const label=r.labels[i]
  const value=demo[field]
  const update=(next:number)=>onChange(changeDemo(demo,field,next))
  return min===max?null:<div className={styles.demoControl} key={field}>
   <label>{label}<input type="range" min={min} max={max} step="1" value={value} disabled={disabled} onChange={e=>update(Number(e.target.value))}/></label>
   <DemoNumber label={label} min={min} max={max} value={value} disabled={disabled} onChange={update}/>
  </div>
 })}</div>
}
function DemoNumber({label,min,max,value,disabled,onChange}:{
 label:string;min:number;max:number;value:number;disabled:boolean;onChange:(value:number)=>void
}){
 const [draft,setDraft]=useState<string|null>(null)
 return <label className={styles.demoNumber}><span>{label} value</span>
  <input type="number" min={min} max={max} step="1" value={draft??value} disabled={disabled}
   onFocus={()=>setDraft(String(value))} onChange={e=>setDraft(e.target.value)}
   onBlur={e=>{if(Number.isFinite(e.target.valueAsNumber))onChange(e.target.valueAsNumber);setDraft(null)}}
   onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/>
 </label>
}

/** Learner exploration never changes the authoritative presented values. */
export function ExploreDemo({demo}:{demo:SlideDemo}){
 const [local,setLocal]=useState(demo)
 return <section className={styles.demoExplore} aria-label="Explore diagram independently">
  <DemoDrawing demo={local} onChange={setLocal}/>
  <DemoResult demo={local}/>
  <DemoControls demo={local} onChange={setLocal}/>
  {demo.kind==='counter-groups'&&<div className={styles.counterActions}>
   {(['a','b'] as const).map((field,i)=><div key={field} role="group" aria-label={i?'Group B':'Group A'}>
    <button type="button" disabled={local[field]===0} onClick={()=>setLocal(changeDemo(local,field,local[field]-1))}>− {i?'B':'A'}</button>
    <button type="button" disabled={local[field]===24} onClick={()=>setLocal(changeDemo(local,field,local[field]+1))}>+ {i?'B':'A'}</button>
   </div>)}
  </div>}
  <button type="button" onClick={()=>setLocal(demo)}>Reset diagram</button>
 </section>
}


export function DemoResult({demo}:{demo:SlideDemo}){
 const summary=teachingToolModel(demo.kind)?.summary(demo.a,demo.b)
 return summary?<output className={styles.demoResult}>{summary}</output>:null
}
