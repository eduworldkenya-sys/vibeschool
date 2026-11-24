'use client'
import styles from './LiveClassroom.module.css'

import { visualSlidePayload, type LiveSlide } from './LiveSlideProtocol'
export { encodeSlide, decodeSlide, validSlide, diagramLabel, SLIDE_DIAGRAMS, SLIDE_THEMES, type LiveSlide, type SlideDiagram, type SlideTheme } from './LiveSlideProtocol'
import {TeachingDiagram} from './LiveTeachingDiagram'
import {SharedObjectBoard} from './LiveObjectBoard'
import {decodeBoard} from './LiveBoardProtocol'
export {TeachingDiagram} from './LiveTeachingDiagram'
export function SlideCanvas({slide,number,total,mini=false}:{slide:LiveSlide;number:number;total:number;mini?:boolean}){
 const visual=visualSlidePayload(slide.body)
 const drawing=visual!==null?decodeBoard(visual):null
 return <div className={styles.presentationCanvas} data-theme={slide.theme??'paper'} data-layout={slide.layout??'wide'} data-font={slide.font??'normal'} data-mini={mini}>
  <div className={styles.presentationKicker}><span>VibeSchool · Slides</span><span>{number} / {total}</span></div>
  <div className={styles.presentationBody}><h2>{slide.title||'Untitled slide'}</h2>{slide.diagram&&slide.diagram!=='none'&&<TeachingDiagram diagram={slide.diagram}/>}{visual!==null?(drawing?<div className={styles.slideVisualSurface}><SharedObjectBoard value={visual}/></div>:<p role="status">Visual slide could not be displayed.</p>):<p>{slide.body}</p>}</div>
 </div>
}
