export const SLIDE_DIAGRAMS = ['none','fraction-circle','fraction-bars','number-line','ruler','protractor','coordinate-grid','counters','base-ten','clock','money','solids','handwriting','music'] as const
export const SLIDE_THEMES = ['paper','ocean','forest','night'] as const
export type SlideDiagram = typeof SLIDE_DIAGRAMS[number]
export type SlideTheme = typeof SLIDE_THEMES[number]
export type LiveSlide = {title:string;body:string;diagram?:SlideDiagram;theme?:SlideTheme;layout?:'wide'|'portrait';font?:'normal'|'large';notes?:string}
export type PublishedSlide = Omit<LiveSlide,'notes'> & {number:number;total:number}
const prefix='VSLIDE1:'
export function validSlide(s:unknown):s is LiveSlide {
 if(!s||typeof s!=='object')return false
 const x=s as LiveSlide
 return typeof x.title==='string'&&x.title.length<=120&&typeof x.body==='string'&&x.body.length<=3878&&(!isDemoBody(x.body)||decodeDemo(x.body)!==null)&&(!isAssessmentBody(x.body)||decodeAssessment(x.body)!==null)
 &&(x.diagram===undefined||SLIDE_DIAGRAMS.includes(x.diagram))&&(x.theme===undefined||SLIDE_THEMES.includes(x.theme))
 &&(x.layout===undefined||x.layout==='wide'||x.layout==='portrait')&&(x.font===undefined||x.font==='normal'||x.font==='large')
 &&(x.notes===undefined||(typeof x.notes==='string'&&x.notes.length<=2000))
}
export function encodeSlide(s:LiveSlide,number:number,total:number):string {
 if(!validSlide(s)||!Number.isInteger(number)||!Number.isInteger(total)||number<1||number>total||total>30||(!s.title.trim()&&!s.body.trim()&&(!s.diagram||s.diagram==='none')))return ''
 // Construct an explicit public projection. Private presenter notes never enter the RPC.
 const body=prefix+JSON.stringify({title:s.title.trim(),body:s.body.trim(),diagram:s.diagram??'none',theme:s.theme??'paper',layout:s.layout??'wide',font:s.font??'normal',number,total})
 return body.length<=4000?body:''
}
export function decodeSlide(body:string):PublishedSlide|null {
 if(!body.startsWith(prefix)||body.length>4000)return null
 try{
  const raw:unknown=JSON.parse(body.slice(prefix.length))
  if(!validSlide(raw)||raw.notes!==undefined)return null
  const x=raw as PublishedSlide
  if(!Number.isInteger(x.number)||!Number.isInteger(x.total)||x.number<1||x.total>30||x.number>x.total)return null
  return {title:x.title,body:x.body,diagram:x.diagram,theme:x.theme,layout:x.layout,font:x.font,number:x.number,total:x.total}
 }catch{return null}
}
export function diagramLabel(d:SlideDiagram){return d==='none'?'Text only':d.replaceAll('-',' ').replace(/^./,s=>s.toUpperCase())}

/** Find a publishable neighbour without exposing unsaved or invalid content.
 * Empty draft placeholders are skipped, but the published numbering is retained.
 * A changed deck must be explicitly presented again before navigation resumes.
 */
export function adjacentSlide(deck: readonly LiveSlide[], current: PublishedSlide, direction: -1 | 1): number | null {
 if(deck.length!==current.total || current.number<1 || current.number>deck.length)return null
 const active=deck[current.number-1]
 if(!active)return null
 const encoded=encodeSlide(active,current.number,deck.length)
 if(!encoded)return null
 const canonical=decodeSlide(encoded)
 if(!canonical || JSON.stringify(canonical)!==JSON.stringify(current))return null
 for(let i=current.number-1+direction;i>=0&&i<deck.length;i+=direction){
  if(encodeSlide(deck[i],i+1,deck.length))return i
 }
 return null
}


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

/** A visual slide is a versioned body variant, not a new database column.
 * The embedded board uses the existing public drawing protocol. Existing
 * text-only slides and private notes remain unchanged.
 */
const VISUAL_SLIDE_PREFIX='VSLIDEVIS1:'
export function visualSlidePayload(body:string):string|null{
 return body.startsWith(VISUAL_SLIDE_PREFIX)?body.slice(VISUAL_SLIDE_PREFIX.length):null
}
export function visualSlideBody(board:string):string{
 return VISUAL_SLIDE_PREFIX+board
}

export type DemoKind='clock'|'fraction-circle'|'fraction-bars'|'number-line'|'ruler'|'coordinate-grid'|'protractor'
export type SlideDemo={kind:DemoKind;a:number;b:number}
const DEMO_PREFIX='VSLIDEDEMO1:'
export const DEMO_RANGES:Record<DemoKind,{a:[number,number];b:[number,number];labels:[string,string];initial:[number,number]}>={
 clock:{a:[1,12],b:[0,59],labels:['Hour','Minute'],initial:[3,30]},
 'fraction-circle':{a:[0,12],b:[1,12],labels:['Shaded parts','Total parts'],initial:[2,4]},
 'fraction-bars':{a:[0,12],b:[1,12],labels:['Shaded parts','Total parts'],initial:[2,4]},
 'number-line':{a:[-10,10],b:[-10,10],labels:['Start','End'],initial:[-3,4]},
 ruler:{a:[0,10],b:[0,10],labels:['Start (cm)','End (cm)'],initial:[2,7]},
 'coordinate-grid':{a:[-4,4],b:[-4,4],labels:['x','y'],initial:[2,3]},
 protractor:{a:[0,180],b:[0,0],labels:['Angle (degrees)','Unused'],initial:[60,0]}
}
export function validDemo(value:unknown):value is SlideDemo {
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const d=value as SlideDemo
 if(!Object.prototype.hasOwnProperty.call(DEMO_RANGES,d.kind)||Object.keys(d).some(k=>!['kind','a','b'].includes(k)))return false
 const r=DEMO_RANGES[d.kind]
 return Number.isInteger(d.a)&&d.a>=r.a[0]&&d.a<=r.a[1]&&Number.isInteger(d.b)&&d.b>=r.b[0]&&d.b<=r.b[1]&&(!d.kind.startsWith('fraction-')||d.a<=d.b)
}
export function isDemoBody(body:string):boolean{return body.startsWith(DEMO_PREFIX)}
export function decodeDemo(body:string):SlideDemo|null{
 if(!isDemoBody(body)||body.length>200)return null
 try{const d:unknown=JSON.parse(body.slice(DEMO_PREFIX.length));return validDemo(d)?{kind:d.kind,a:d.a,b:d.b}:null}catch{return null}
}
export function encodeDemo(d:SlideDemo):string{return validDemo(d)?DEMO_PREFIX+JSON.stringify({kind:d.kind,a:d.a,b:d.b}):''}
export function defaultDemo(kind:DemoKind):SlideDemo{
 const [a,b]=DEMO_RANGES[kind].initial;return {kind,a,b}
}
export function changeDemo(d:SlideDemo,field:'a'|'b',value:number):SlideDemo{
 const range=DEMO_RANGES[d.kind][field]
 if(!Number.isFinite(value))return d
 const next={...d,[field]:Math.min(range[1],Math.max(range[0],Math.round(value)))}
 if(next.kind.startsWith('fraction-'))next.a=Math.min(next.a,next.b)
 return next
}
export function buildTextRevealSlides(slide:LiveSlide,available:number):LiveSlide[]{
 if(isDemoBody(slide.body)||isAssessmentBody(slide.body)||visualSlidePayload(slide.body)!==null)return []
 const lines=slide.body.split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
 if(lines.length<2||lines.length>available||lines.length>30)return []
 const steps=lines.map((_,i)=>({...slide,body:lines.slice(0,i+1).join('\n')}))
 return steps.every((s,i)=>Boolean(encodeSlide(s,i+1,steps.length)))?steps:[]
}

export type SlideAssessment={kind:'quiz'|'poll';question:string;options:string[]}
const ASSESSMENT_PREFIX='VSLIDEASK1:'
export function isAssessmentBody(body:string):boolean{return body.startsWith(ASSESSMENT_PREFIX)}
export function validAssessment(value:unknown):value is SlideAssessment{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const a=value as SlideAssessment
 return Object.keys(a).every(k=>['kind','question','options'].includes(k))&&(a.kind==='quiz'||a.kind==='poll')&&typeof a.question==='string'&&!!a.question.trim()&&a.question.length<=500&&Array.isArray(a.options)&&a.options.length>=2&&a.options.length<=6&&a.options.every(o=>typeof o==='string'&&!!o.trim()&&o.length<=140&&!/[\r\n]/.test(o))&&new Set(a.options.map(o=>o.trim().toLowerCase())).size===a.options.length
}
export function decodeAssessment(body:string):SlideAssessment|null{
 if(!isAssessmentBody(body)||body.length>2000)return null
 try{const v:unknown=JSON.parse(body.slice(ASSESSMENT_PREFIX.length));return validAssessment(v)?{kind:v.kind,question:v.question,options:v.options}:null}catch{return null}
}
export function encodeAssessment(a:SlideAssessment):string{return validAssessment(a)?ASSESSMENT_PREFIX+JSON.stringify({kind:a.kind,question:a.question.trim(),options:a.options.map(o=>o.trim())}):''}
export function assessmentPrompt(a:SlideAssessment):string{return a.question.trim()+'\n'+a.options.map((o,i)=>String.fromCharCode(65+i)+'. '+o.trim()).join('\n')}
