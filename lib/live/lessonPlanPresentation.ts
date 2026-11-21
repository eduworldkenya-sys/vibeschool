import { parseLessonPlanBody } from '../teaching/lessonPlanCodec'
import { encodeSlide, type LiveSlide } from '../../components/live-classroom/LiveSlideProtocol'

/** Teacher explicitly presents selected saved-plan phases. The learner never receives
 * private assessment keys, differentiation or homework guidance through this adapter.
 * The canonical lesson_plans row remains the source; this adapter is not an editor.
 */
export function lessonPlanSlides(raw:string,topic:string):LiveSlide[]|null {
 const sections=parseLessonPlanBody(raw)
 if(!sections)return null
 const phases=[
  ['Objectives',sections.objectives],
  ['Introduction',sections.introduction],
  ['Development',sections.development],
  ['Consolidation',sections.consolidation],
 ] as const
 const slides:LiveSlide[]=[]
 for(const [phase,source] of phases) {
  let remaining=source.trim()
  if(!remaining)continue
  while(remaining){
   if(slides.length>=30)return null
   const limit=2900
   let end=Math.min(limit,remaining.length)
   if(end<remaining.length){
    const word=remaining.lastIndexOf(' ',end)
    const line=remaining.lastIndexOf('\n',end)
    const good=Math.max(word,line)
    if(good>limit/2)end=good
   }
   const body=remaining.slice(0,end).trim()
   if(!body)return null
   const page=slides.filter(s=>s.title===phase).length+1
   slides.push({title:phase+(page>1?' · '+page:''),body,theme:'paper',layout:'wide'})
   remaining=remaining.slice(end).trim()
  }
 }
 if(!slides.length)return null
 const normalized=(topic||'Lesson Plan').trim().slice(0,120)
 // The class teacher must choose Present slide: no implicit publication here.
 // Verify that every page passes the already-enforced bounded wire format.
 if(!slides.every((s,i)=>Boolean(encodeSlide(s,i+1,slides.length))))return null
 void normalized
 return slides
}
