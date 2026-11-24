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
 return typeof x.title==='string'&&x.title.length<=120&&typeof x.body==='string'&&x.body.length<=3878
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
