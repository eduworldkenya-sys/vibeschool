'use client'
import styles from './LiveClassroom.module.css'

import { visualSlidePayload, decodeDemo, isDemoBody, decodeAssessment, decodePhotoSlide, decodeMultiDemo, type LiveSlide } from './LiveSlideProtocol'
export { encodeSlide, decodeSlide, validSlide, diagramLabel, SLIDE_DIAGRAMS, SLIDE_THEMES, type LiveSlide, type SlideDiagram, type SlideTheme } from './LiveSlideProtocol'
import {TeachingDiagram} from './LiveTeachingDiagram'
import {DemoDrawing,ExploreDemo} from './LiveAdjustableDiagram'
import {MultiDiagramView} from './LiveMultiDiagram'
import {PhotoSurface} from './LiveSlidePhotos'
import {SharedObjectBoard} from './LiveObjectBoard'
import {decodeBoard} from './LiveBoardProtocol'
export {TeachingDiagram} from './LiveTeachingDiagram'
export function SlideCanvas({slide,number,total,mini=false,explore=false,roomId,ownerPhotoPreview=false}:{slide:LiveSlide;number:number;total:number;mini?:boolean;explore?:boolean;roomId?:string;ownerPhotoPreview?:boolean}){
 const multi=decodeMultiDemo(slide.body)
 const photos=decodePhotoSlide(slide.body)
 const assessment=decodeAssessment(slide.body)
 const demo=decodeDemo(slide.body)
 const visual=visualSlidePayload(slide.body)
 const drawing=visual!==null?decodeBoard(visual):null
 return <div className={styles.presentationCanvas} data-theme={slide.theme??'paper'} data-layout={slide.layout??'wide'} data-font={slide.font??'normal'} data-mini={mini}>
  <div className={styles.presentationKicker}><span>VibeSchool · Slides</span><span>{number} / {total}</span></div>
  <div className={styles.presentationBody}><h2>{slide.title||'Untitled slide'}</h2>{!multi&&!photos&&!demo&&!assessment&&slide.diagram&&slide.diagram!=='none'&&<TeachingDiagram diagram={slide.diagram}/>}{multi?<MultiDiagramView items={multi} explore={explore} mini={mini}/>:photos?<PhotoSurface doc={photos} roomId={roomId} mini={mini} ownerPreview={ownerPhotoPreview}/>:assessment?<section aria-label={assessment.kind==='quiz'?'Quiz slide':'Poll slide'}><p>{assessment.question}</p><ol type="A">{assessment.options.map((o,i)=><li key={i}>{o}</li>)}</ol>{!mini&&<small>{assessment.kind==='quiz'?'Your teacher can launch this quiz in Live Lesson.':'Your teacher can launch this poll in Live Lesson.'}</small>}</section>:demo?(explore&&!mini?<ExploreDemo key={slide.body} demo={demo}/>:<DemoDrawing demo={demo}/>):isDemoBody(slide.body)?<p>Invalid demonstration.</p>:visual!==null?(drawing?<div className={styles.slideVisualSurface}><SharedObjectBoard value={visual} animate={!mini}/></div>:<p role="status">Visual slide could not be displayed.</p>):<p>{slide.body}</p>}</div>
 </div>
}
