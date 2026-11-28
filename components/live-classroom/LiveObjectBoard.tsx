'use client'
import {createPortal} from 'react-dom'
import {useRef,useState,type PointerEvent} from 'react'
import {TeachingDiagram} from './LiveTeachingDiagram'
import {diagramLabel,defaultDemo,DEMO_RANGES,type DemoKind} from './LiveSlideProtocol'
import {DemoDrawing,DemoControls} from './LiveAdjustableDiagram'
import {TeachingModelOptions} from './TeachingModelPicker'
import {BOARD_COLORS,BOARD_DIAGRAMS,BOARD_LIMIT,boardFromLegacy,encodeBoard,decodeBoard,nextBoardDemoPosition,type BoardDocument,type BoardObject,type BoardKind,type BoardColor} from './LiveBoardProtocol'
import styles from './LiveClassroom.module.css'

function objectContent(o:BoardObject){
 const common={stroke:o.color,strokeWidth:o.stroke,fill:'none',strokeLinecap:'round' as const,strokeLinejoin:'round' as const}
 const pts=(o.points??[]).reduce<string[]>((a,n,i,arr)=>i%2===0?[...a,`${Math.round(n*o.w/1000)},${Math.round(arr[i+1]*o.h/1000)}`]:a,[])
 if(o.kind==='pen'||o.kind==='highlighter'||o.kind==='line'||o.kind==='arrow'){
  const tip=pts.at(-1)?.split(',').map(Number),prev=pts.at(-2)?.split(',').map(Number)
  const angle=tip&&prev?Math.atan2(tip[1]-prev[1],tip[0]-prev[0]):0
  return <g opacity={o.kind==='highlighter'?.32:1}>{pts.length===1?<circle cx={pts[0].split(',')[0]} cy={pts[0].split(',')[1]} r={o.stroke/2} fill={o.color}/>:<polyline points={pts.join(' ')} {...common}/>}
   {o.kind==='arrow'&&tip&&prev&&<path d={`M${tip[0]-12*Math.cos(angle-.5)} ${tip[1]-12*Math.sin(angle-.5)}L${tip[0]} ${tip[1]}L${tip[0]-12*Math.cos(angle+.5)} ${tip[1]-12*Math.sin(angle+.5)}`} {...common}/>}</g>
 }
 if(o.kind==='rectangle')return <rect width={o.w} height={o.h} {...common}/>
 if(o.kind==='ellipse')return <ellipse cx={o.w/2} cy={o.h/2} rx={o.w/2} ry={o.h/2} {...common}/>
 if(o.kind==='triangle')return <path d={`M${o.w/2} 0L${o.w} ${o.h}H0Z`} {...common}/>
 if(o.kind==='text')return <text x="0" y={Math.max(11,Math.min(32,o.h))} fontSize={Math.max(11,Math.min(32,o.h))} fill={o.color} textLength={o.text&&o.text.length>4?o.w:undefined} lengthAdjust="spacingAndGlyphs">{o.text}</text>
 if(o.kind==='diagram'&&o.demo)return <svg x="0" y="0" width={o.w} height={o.h} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet"><DemoDrawing demo={o.demo}/></svg>
 if(o.kind==='diagram'&&o.diagram)return <svg x="0" y="0" width={o.w} height={o.h} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet"><TeachingDiagram diagram={o.diagram} embedded/></svg>
 return null
}
function DrawObjects({doc,selected}:{doc:BoardDocument;selected?:string|null}){
 return <><rect width="100%" height="100%" fill="#fff"/>
 {doc.background!=='plain'&&Array.from({length:34},(_,i)=><g key={i} stroke="#d5e3ed" strokeWidth=".6"><path d={`M-320 ${i*20-220}H640`}/>{doc.background==='grid'&&<path d={`M${i*20-320} -220V440`}/>}</g>)}
 {doc.objects.map(o=><g key={o.id} data-object={o.id} transform={`translate(${o.x} ${o.y}) rotate(${o.angle} ${o.w/2} ${o.h/2})`}>
  <rect width={o.w} height={o.h} fill="transparent" stroke="none"/>{objectContent(o)}
  {selected===o.id&&<rect x="-3" y="-3" width={o.w+6} height={o.h+6} stroke="#077e72" strokeDasharray="4 3" strokeWidth="1.5" fill="none" pointerEvents="none"/>}
 </g>)}</>
}
export function SharedObjectBoard({value,animate=false}:{value:string;animate?:boolean}){
 const doc=decodeBoard(value);if(!doc)return null
 return <svg className={styles.board} data-reveal-motion={animate?'true':undefined} viewBox="0 0 320 220" role="img" aria-label={`Shared board page ${doc.page} of ${doc.total}`}><DrawObjects doc={doc}/></svg>
}
type Tool=BoardKind|'select'|'erase'|'pan'
type Point={x:number;y:number}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(n)))
const box=(points:Point[])=>{const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),w=Math.max(1,...points.map(p=>p.x-x)),h=Math.max(1,...points.map(p=>p.y-y));return {x,y,w,h,points:points.flatMap(p=>[clamp((p.x-x)*1000/w,0,1000),clamp((p.y-y)*1000/h,0,1000)])}}
export function ObjectBoard({value,page,total,onChange,disabled,onUndo,onRedo,canUndo,canRedo,allowAdjustable=false,toolsHost}:{value:string;page:number;total:number;onChange:(value:string)=>void;disabled:boolean;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;allowAdjustable?:boolean;toolsHost?:HTMLElement|null}){
 const doc=boardFromLegacy(value,page,total)
 const [tool,setTool]=useState<Tool>('pen'),[color,setColor]=useState<BoardColor>(BOARD_COLORS[0]),[width,setWidth]=useState(3),[selected,setSelected]=useState<string|null>(null),[message,setMessage]=useState(''),[preview,setPreview]=useState<BoardDocument|null>(null),[zoom,setZoom]=useState(1),[pan,setPan]=useState<Point>({x:0,y:0}),[text,setText]=useState(''),[diagram,setDiagram]=useState(BOARD_DIAGRAMS[0])
 const [demoKind,setDemoKind]=useState<DemoKind>('ruler')
 const gesture=useRef<{id:number;start:Point;points:Point[];source:BoardDocument;object?:BoardObject;pan?:Point;createdId?:string}|null>(null)
 const touches=useRef(new Map<number,Point>()),pinch=useRef<{distance:number;zoom:number}|null>(null)
 const latest=useRef<BoardDocument|null>(null),svg=useRef<SVGSVGElement>(null)
 const selectedObject=doc.objects.find(o=>o.id===selected)
 const commit=(next:BoardDocument)=>{const encoded=encodeBoard(next);if(!encoded){setMessage('Board page full. Add a page or remove an object.');return}setMessage('');if(encoded!==value)onChange(encoded)}
 function patchObject(p:Partial<BoardObject>,allowLocked=false){if(disabled||!selectedObject||(!allowLocked&&selectedObject.locked))return;commit({...doc,objects:doc.objects.map(o=>o.id===selected?{...o,...p}:o)})}
 function layer(dir:number){if(!selectedObject||selectedObject.locked||disabled)return;const a=doc.objects.findIndex(o=>o.id===selected),b=a+dir;if(b<0||b>=doc.objects.length)return;const next=[...doc.objects];[next[a],next[b]]=[next[b],next[a]];commit({...doc,objects:next})}
 function createObject(kind:BoardKind,xy:Point):BoardObject{return {id:crypto.randomUUID().replaceAll('-',''),kind,x:xy.x,y:xy.y,w:1,h:1,angle:0,color,stroke:kind==='highlighter'?Math.max(7,width):width}}
 function add(kind:'text'|'diagram'){
  if(disabled||kind==='text'&&!text.trim())return
  const o={...createObject(kind,{x:55,y:45}),w:kind==='diagram'?210:150,h:kind==='diagram'?118:20,...(kind==='diagram'?{diagram}:{text:text.trim()})}
  commit({...doc,objects:[...doc.objects,o]});setSelected(o.id);setTool('select');setText('')
 }
 function addDemo(){
  if(disabled||!allowAdjustable)return
  const o:BoardObject={...createObject('diagram',nextBoardDemoPosition(doc.objects)),w:150,h:85,demo:defaultDemo(demoKind)}
  commit({...doc,objects:[...doc.objects,o]});setSelected(o.id);setTool('select')
 }
 const point=(e:PointerEvent<SVGSVGElement>):Point=>{const root=e.currentTarget,m=root.getScreenCTM();if(!m)return {x:0,y:0};const p=root.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const r=p.matrixTransform(m.inverse());return {x:clamp(r.x,-320,640),y:clamp(r.y,-220,440)}}
 function start(e:PointerEvent<SVGSVGElement>){
  if(disabled||e.button!==0)return
  if(e.pointerType==='touch'){
   touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId)
   if(touches.current.size>=2){const [a,b]=[...touches.current.values()];pinch.current={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom};gesture.current=null;latest.current=null;setPreview(null);return}
  }
  if(!e.isPrimary||pinch.current)return
  const xy=point(e),target=(e.target as Element).closest('[data-object]')?.getAttribute('data-object'),o=doc.objects.find(a=>a.id===target)
  if(tool==='erase'){if(o&&!o.locked)commit({...doc,objects:doc.objects.filter(a=>a.id!==o.id)});return}
  if(tool==='text'||tool==='diagram')return
  if(tool==='select'){setSelected(o?.id??null);if(!o||o.locked)return}
  if(tool!=='select')setSelected(null)
  e.currentTarget.setPointerCapture(e.pointerId)
  gesture.current={id:e.pointerId,start:xy,points:[xy],source:doc,object:o,pan:tool==='pan'?pan:undefined,createdId:crypto.randomUUID().replaceAll('-','')}
 }
 function move(e:PointerEvent<SVGSVGElement>){
  if(e.pointerType==='touch'&&touches.current.has(e.pointerId)){
   touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
   if(pinch.current&&touches.current.size>=2){const [a,b]=[...touches.current.values()];setZoom(Math.max(1,Math.min(4,pinch.current.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.current.distance)));return}
  }
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;const xy=point(e)
  if(g.pan){setPan({x:clamp(g.pan.x-(xy.x-g.start.x),-240,240),y:clamp(g.pan.y-(xy.y-g.start.y),-160,160)});return}
  let next:BoardDocument
  if(tool==='select'&&g.object){const o=g.object;next={...g.source,objects:g.source.objects.map(a=>a.id===o.id?{...a,x:clamp(o.x+xy.x-g.start.x,-320,640),y:clamp(o.y+xy.y-g.start.y,-220,440)}:a)}}
  else if(tool!=='select'&&tool!=='erase'&&tool!=='pan'&&tool!=='text'&&tool!=='diagram'){
   const free=tool==='pen'||tool==='highlighter'
   if(free&&g.points.length<100&&Math.hypot(xy.x-g.points.at(-1)!.x,xy.y-g.points.at(-1)!.y)>1)g.points.push(xy)
   const bounds=box(free?g.points:[g.start,xy]),o={...createObject(tool,g.start),id:g.createdId!,x:bounds.x,y:bounds.y,w:bounds.w,h:bounds.h,...(['pen','highlighter','line','arrow'].includes(tool)?{points:bounds.points}:{})}
   next={...g.source,objects:[...g.source.objects,o]}
  }else return
  if(encodeBoard(next)){latest.current=next;setPreview(next)}else setMessage('Page full. Add another page.')
 }
 function stop(e:PointerEvent<SVGSVGElement>){
  touches.current.delete(e.pointerId);if(touches.current.size<2)pinch.current=null
  const g=gesture.current;if(g?.id!==e.pointerId)return
  if(latest.current)commit(latest.current)
  else if(tool==='pen'||tool==='highlighter'){const o={...createObject(tool,g.start),points:[0,0]};commit({...g.source,objects:[...g.source.objects,o]})}
  gesture.current=null;latest.current=null;setPreview(null)
 }
 function cancel(e:PointerEvent<SVGSVGElement>){touches.current.delete(e.pointerId);pinch.current=null;gesture.current=null;latest.current=null;setPreview(null)}
 function exportCurrent(format:'svg'|'png'){
  if(!svg.current)return
  const clone=svg.current.cloneNode(true) as SVGSVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('viewBox','0 0 320 220');clone.setAttribute('width','960');clone.setAttribute('height','660')
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}))
  const save=(u:string,ext:string)=>{const link=document.createElement('a');link.href=u;link.download='vibeschool-board-'+page+'.'+ext;link.click()}
  if(format==='svg'){save(url,'svg');setTimeout(()=>URL.revokeObjectURL(url),1000);return}
  const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=960;canvas.height=660;canvas.getContext('2d')?.drawImage(image,0,0);URL.revokeObjectURL(url);canvas.toBlob(blob=>{if(!blob)return;const u=URL.createObjectURL(blob);save(u,'png');setTimeout(()=>URL.revokeObjectURL(u),1000)})};image.onerror=()=>{URL.revokeObjectURL(url);setMessage('Could not export this page.')};image.src=url
 }
 const toolbar=<div className={styles.boardTools}><label>Tool<select aria-label="Tool" value={tool} disabled={disabled} onChange={e=>setTool(e.target.value as Tool)}>{(['pen','highlighter','line','rectangle','triangle','ellipse','arrow','select','erase','pan'] as Tool[]).map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Colour<select aria-label="Colour" disabled={disabled} value={color} onChange={e=>{const c=e.target.value as BoardColor;setColor(c);patchObject({color:c})}}>{BOARD_COLORS.map((c,i)=><option key={c} value={c}>{['Ink','Blue','Red','Green','Gold','Violet'][i]}</option>)}</select></label><label>Width<select aria-label="Width" disabled={disabled} value={width} onChange={e=>{setWidth(+e.target.value);patchObject({stroke:+e.target.value})}}>{[1,3,5,8,12].map(n=><option key={n}>{n}</option>)}</select></label><label>Background<select aria-label="Background" value={doc.background} disabled={disabled} onChange={e=>commit({...doc,background:e.target.value as BoardDocument['background']})}><option value="plain">Plain</option><option value="grid">Grid</option><option value="ruled">Ruled</option></select></label></div>
 const controls=<>
  <div className={styles.boardTools}><button disabled={disabled||!canUndo} onClick={onUndo}>Undo</button><button disabled={disabled||!canRedo} onClick={onRedo}>Redo</button><button onClick={()=>setZoom(v=>Math.max(1,v-.5))}>−</button><button onClick={()=>{setZoom(1);setPan({x:0,y:0})}}>{Math.round(zoom*100)}%</button><button onClick={()=>setZoom(v=>Math.min(4,v+.5))}>+</button><button disabled={disabled||!doc.objects.length} onClick={()=>{if(window.confirm('Clear this draft page? Published history remains.'))commit({...doc,objects:[]})}}>Clear</button></div>
  <div className={styles.boardTools}><input aria-label="Board text" placeholder="Text or equation" maxLength={180} value={text} disabled={disabled} onChange={e=>setText(e.target.value)}/><button disabled={disabled||!text.trim()} onClick={()=>add('text')}>Insert text</button></div>
  <div className={styles.boardTools}><select aria-label="Teaching diagram" value={diagram} disabled={disabled} onChange={e=>setDiagram(e.target.value as typeof diagram)}>{BOARD_DIAGRAMS.map(d=><option key={d} value={d}>{diagramLabel(d)}</option>)}</select><button disabled={disabled} onClick={()=>add('diagram')}>Insert diagram</button></div>
  {allowAdjustable&&<div className={styles.boardTools}><label>Adjustable teaching tool<select aria-label="Adjustable teaching tool" value={demoKind} disabled={disabled} onChange={e=>{const k=e.target.value as DemoKind;if(Object.prototype.hasOwnProperty.call(DEMO_RANGES,k))setDemoKind(k)}}><TeachingModelOptions/></select></label><button type="button" disabled={disabled} onClick={addDemo}>Insert tool</button></div>}
  {allowAdjustable&&selectedObject?.demo&&<DemoControls demo={selectedObject.demo} disabled={disabled||!!selectedObject.locked} onChange={demo=>patchObject({demo})}/>}
  {selectedObject?.kind==='text'&&<label>Edit selected text<input aria-label="Edit selected text" value={selectedObject.text??''} maxLength={180} disabled={disabled||!!selectedObject.locked} onChange={e=>{if(e.target.value.trim())patchObject({text:e.target.value})}}/></label>}
  {selectedObject&&<div className={styles.boardTools}><button disabled={disabled} aria-pressed={!!selectedObject.locked} onClick={()=>patchObject({locked:!selectedObject.locked},true)}>{selectedObject.locked?'Unlock':'Lock'}</button><button disabled={disabled||selectedObject.locked} onClick={()=>patchObject({angle:(selectedObject.angle+15)%360})}>Rotate</button><button disabled={disabled||selectedObject.locked} onClick={()=>patchObject({w:Math.max(1,Math.round(selectedObject.w*.85)),h:Math.max(1,Math.round(selectedObject.h*.85))})}>Smaller</button><button disabled={disabled||selectedObject.locked} onClick={()=>patchObject({w:Math.min(640,Math.round(selectedObject.w*1.15)),h:Math.min(440,Math.round(selectedObject.h*1.15))})}>Larger</button><button disabled={disabled||selectedObject.locked} onClick={()=>layer(-1)}>Back</button><button disabled={disabled||selectedObject.locked} onClick={()=>layer(1)}>Front</button><button disabled={disabled||selectedObject.locked} onClick={()=>{const o={...selectedObject,id:crypto.randomUUID().replaceAll('-',''),x:Math.min(640,selectedObject.x+8),y:Math.min(440,selectedObject.y+8)};commit({...doc,objects:[...doc.objects,o]});setSelected(o.id)}}>Duplicate</button><button disabled={disabled||selectedObject.locked} onClick={()=>{commit({...doc,objects:doc.objects.filter(o=>o.id!==selected)});setSelected(null)}}>Delete</button></div>}
  <div className={styles.boardTools}><button onClick={()=>exportCurrent('svg')}>Export SVG</button><button onClick={()=>exportCurrent('png')}>Export PNG</button><small role="status">{message||`${Math.round(value.length/BOARD_LIMIT*100)}% page used`}</small></div>
 </>
 return <div className={styles.objectBoard}>
  {toolsHost?createPortal(toolbar,toolsHost):toolbar}
  <svg ref={svg} className={styles.board} role="img" aria-label="Editable drawing board" viewBox={`${160-160/zoom+pan.x} ${110-110/zoom+pan.y} ${320/zoom} ${220/zoom}`} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={cancel}><DrawObjects doc={preview??doc} selected={selected}/></svg>
  {toolsHost?createPortal(controls,toolsHost):controls}
 </div>
}
