import {decodeSlide,encodeSlide,decodeAssessment,preparedAssessment,isPhotoBody,visualSlidePayload,decodeDemo,decodeMultiDemo,encodeAssessment,encodeDemo,encodeMultiDemo,type LiveSlide,type PublishedSlide} from '@/components/live-classroom/LiveSlideProtocol'
export type MiniSlideEntry={encoded:string;answer?:{option:number;explanation:string}}
type MiniSlide={slide:PublishedSlide;answer?:MiniSlideEntry['answer']}
export const MINI_SLIDE_LIMIT=10
export function miniDeckText(deck:readonly MiniSlide[]):string{
 return deck.flatMap(({slide,answer})=>{const q=decodeAssessment(slide.body);return [slide.title,q?[q.question,...q.options].join('\n'):decodeDemo(slide.body)||decodeMultiDemo(slide.body)?'':slide.body,answer?.explanation??'']}).join('\n')
}
export function parseMiniDeck(raw:unknown):MiniSlide[]|null{
 if(!Array.isArray(raw)||raw.length<2||raw.length>10)return null
 const result:MiniSlide[]=[]
 for(const [i,entry] of raw.entries()){
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(k=>k!=='encoded'&&k!=='answer')||typeof entry.encoded!=='string')return null
  const slide=decodeSlide(entry.encoded)
  if(!slide||slide.number!==i+1||slide.total!==raw.length||encodeSlide(slide,i+1,raw.length)!==entry.encoded||isPhotoBody(slide.body)||visualSlidePayload(slide.body)!==null)return null
  if(/^VSLIDE[A-Z0-9]*:/.test(slide.body)&&!decodeAssessment(slide.body)&&!decodeDemo(slide.body)&&!decodeMultiDemo(slide.body))return null
  const q=decodeAssessment(slide.body),demo=decodeDemo(slide.body),multi=decodeMultiDemo(slide.body),a=entry.answer
  if((q&&encodeAssessment(q)!==slide.body)||(demo&&encodeDemo(demo)!==slide.body)||(multi&&encodeMultiDemo(multi)!==slide.body))return null
  if(q?.kind==='quiz'){
   if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>k!=='option'&&k!=='explanation')||!Number.isInteger(a.option)||a.option<0||a.option>=q.options.length||typeof a.explanation!=='string'||a.explanation.length>800)return null
   result.push({slide,answer:{option:a.option,explanation:a.explanation}})
  }else{if(a!==undefined)return null;result.push({slide})}
 }
 return miniDeckText(result).length<=3500?result:null
}
export function buildMiniDeck(slides:readonly LiveSlide[]):MiniSlideEntry[]{
 const entries=slides.map((s,i)=>{const encoded=encodeSlide(s,i+1,slides.length),a=preparedAssessment(s);return a?{encoded,answer:{option:a.option,explanation:a.explanation}}:{encoded}})
 if(!parseMiniDeck(entries))throw Error('Use 2–10 complete slides with quiz answers and up to 3,500 characters of text. Room photos and visual drawings are not supported yet.')
 return entries
}
