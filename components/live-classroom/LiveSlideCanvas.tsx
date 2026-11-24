'use client'
import styles from './LiveClassroom.module.css'

import { visualSlidePayload, decodeDemo, isDemoBody, type LiveSlide } from './LiveSlideProtocol'
export { encodeSlide, decodeSlide, validSlide, diagramLabel, SLIDE_DIAGRAMS, SLIDE_THEMES, type LiveSlide, type SlideDiagram, type SlideTheme } from './LiveSlideProtocol'
import {TeachingDiagram} from './LiveTeachingDiagram'
import {DemoDrawing,ExploreDemo} from './LiveAdjustableDiagram'
import {SharedObjectBoard} from './LiveObjectBoard'
import {decodeBoard} from './LiveBoardProtocol'
export {TeachingDiagram} from './LiveTeachingDiagram'
export function SlideCanvas({slide,number,total,mini=false,explore=false}:{slide:LiveSlide;number:number;total:number;mini?:boolean;explore?:boolean}){
 const demo=decodeDemo(slide.body)
 const visual=visualSlidePayload(slide.body)
 const drawing=visual!==null?decodeBoard(visual):null
 return <div className={styles.presentationCanvas} data-theme={slide.theme??'paper'} data-layout={slide.layout??'wide'} data-font={slide.font??'normal'} data-mini={mini}>
  <div className={styles.presentationKicker}><span>VibeSchool · Slides</span><span>{number} / {total}</span></div>
  <div className={styles.presentationBody}><h2>{slide.title||'Untitled slide'}</h2>{!demo&&slide.diagram&&slide.diagram!=='none'&&<TeachingDiagram diagram={slide.diagram}/>}{demo?(explore&&!mini?<ExploreDemo key={slide.body} demo={demo}/>:<DemoDrawing demo={demo}/>):isDemoBody(slide.body)?<p>Invalid demonstration.</p>:visual!==null?(drawing?<div className={styles.slideVisualSurface}><SharedObjectBoard value={visual}/></div>:<p role="status">Visual slide could not be displayed.</p>):<p>{slide.body}</p>}</div>
 </div>
}
