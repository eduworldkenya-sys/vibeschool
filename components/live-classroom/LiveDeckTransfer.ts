import {validSlide,encodeSlide,type LiveSlide} from './LiveSlideProtocol.ts'

export const MAX_DECK_FILE_BYTES=512_000
export type PortableDeck={format:'vibeschool-slides';version:1;title:string;slides:LiveSlide[]}
const allowed=new Set(['title','body','diagram','theme','layout','font','notes'])

function projectSlide(s:LiveSlide,includeNotes:boolean):LiveSlide {
 return {title:s.title,body:s.body,...(s.diagram!==undefined?{diagram:s.diagram}:{}),...(s.theme!==undefined?{theme:s.theme}:{}),...(s.layout!==undefined?{layout:s.layout}:{}),...(s.font!==undefined?{font:s.font}:{}),...(includeNotes&&s.notes!==undefined?{notes:s.notes}:{})}
}
function checkedDeck(title:unknown,slides:unknown,includeNotes:boolean):PortableDeck {
 if(typeof title!=='string'||!title.trim()||title.length>120)throw Error('Presentation name must contain 1–120 characters.')
 if(!Array.isArray(slides)||slides.length<1||slides.length>30)throw Error('A presentation must contain 1–30 slides.')
 const cleaned=slides.map((slide:unknown,i:number)=>{
  if(!validSlide(slide)||Object.keys(slide).some(k=>!allowed.has(k)))throw Error('Invalid slide '+(i+1)+'.')
  return projectSlide(slide,includeNotes)
 })
 // Match the server deck budget conservatively and reject content that
 // cannot be broadcast within the existing public slide protocol.
 if(new TextEncoder().encode(JSON.stringify(cleaned)).length>170_000)throw Error('Presentation is too large.')
 for(const [i,s] of cleaned.entries()){
  const blank=!s.title.trim()&&!s.body.trim()&&(!s.diagram||s.diagram==='none')
  if(!blank&&!encodeSlide(s,i+1,cleaned.length))throw Error('Slide '+(i+1)+' is too large to present.')
 }
 return {format:'vibeschool-slides',version:1,title:title.trim(),slides:cleaned}
}
export function exportDeck(title:string,slides:LiveSlide[],includeNotes=false):string{
 return JSON.stringify(checkedDeck(title,slides,includeNotes),null,2)
}
export function importDeck(source:string):PortableDeck{
 if(new TextEncoder().encode(source).length>MAX_DECK_FILE_BYTES)throw Error('Presentation file is too large.')
 let data:unknown
 try{data=JSON.parse(source)}catch{throw Error('Invalid VibeSchool presentation file.')}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid presentation.')
 const record=data as Record<string,unknown>
 if(record.format!=='vibeschool-slides'||record.version!==1||Object.keys(record).some(k=>!['format','version','title','slides'].includes(k)))throw Error('Unsupported presentation format.')
 return checkedDeck(record.title,record.slides,true)
}
