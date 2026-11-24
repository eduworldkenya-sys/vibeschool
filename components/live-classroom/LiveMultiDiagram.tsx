'use client'
import {DemoControls,DemoDrawing,ExploreDemo} from './LiveAdjustableDiagram'
import {DEMO_RANGES,defaultDemo,diagramLabel,encodeMultiDemo,type DemoKind,type PositionedDemo,type SlideDemo} from './LiveSlideProtocol'
import styles from './LiveClassroom.module.css'
export function MultiDiagramView({items,explore,mini}:{items:PositionedDemo[];explore:boolean;mini:boolean}){
 return <div className={styles.multiDemoGrid}>{items.map(item=><section key={item.id} aria-label={diagramLabel(item.demo.kind)}>{explore&&!mini?<ExploreDemo key={JSON.stringify(item.demo)} demo={item.demo}/>:<DemoDrawing demo={item.demo}/>}</section>)}</div>
}
export function MultiDiagramEditor({items,disabled,onChange}:{items:PositionedDemo[];disabled:boolean;onChange:(body:string)=>void}){
 function change(next:PositionedDemo[]){if(!disabled&&next.length)onChange(encodeMultiDemo(next))}
 function add(kind:DemoKind){if(items.length<4)change([...items,{id:crypto.randomUUID(),demo:defaultDemo(kind)}])}
 function move(i:number,by:number){const j=i+by;if(j<0||j>=items.length)return;const next=[...items];[next[i],next[j]]=[next[j],next[i]];change(next)}
 return <section className={styles.slideFields} aria-label="Multiple adjustable diagrams">
 {items.map((item,i)=><section key={item.id} className={styles.slideFields}><strong>{i+1}. {diagramLabel(item.demo.kind)}</strong><DemoControls demo={item.demo} disabled={disabled} onChange={(demo:SlideDemo)=>change(items.map(v=>v.id===item.id?{...v,demo}:v))}/><div className={styles.slideToolbar}><button type="button" disabled={disabled||i===0} onClick={()=>move(i,-1)}>Move earlier</button><button type="button" disabled={disabled||i===items.length-1} onClick={()=>move(i,1)}>Move later</button><button type="button" disabled={disabled||items.length===1} onClick={()=>change(items.filter(v=>v.id!==item.id))}>Remove</button></div></section>)}
 <label>Add diagram<select value="" disabled={disabled||items.length>=4} onChange={e=>{const k=e.target.value as DemoKind;if(Object.prototype.hasOwnProperty.call(DEMO_RANGES,k))add(k)}}><option value="">Choose diagram</option>{Object.keys(DEMO_RANGES).map(k=><option key={k} value={k}>{diagramLabel(k as DemoKind)}</option>)}</select></label>
 <button type="button" disabled={disabled} onClick={()=>{if(window.confirm('Replace all diagrams with a text slide?'))onChange('')}}>Switch to text</button>
 </section>
}
