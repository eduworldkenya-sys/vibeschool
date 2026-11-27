import {validDemo,decodeDemo,decodeMultiDemo,visualSlidePayload,visualSlideBody,type SlideDiagram,type SlideDemo} from './LiveSlideProtocol.ts'
export const BOARD_DIAGRAMS:readonly SlideDiagram[]=['fraction-circle','fraction-bars','number-line','ruler','protractor','coordinate-grid','counters','base-ten','clock','money','solids','handwriting','music']
export const BOARD_LIMIT=3500
export const BOARD_COLORS=['#182b3a','#1865c0','#bf3038','#167d58','#a06a05','#7e41b6'] as const
export const BOARD_KINDS=['pen','highlighter','line','rectangle','triangle','ellipse','arrow','text','diagram'] as const
export type BoardKind=typeof BOARD_KINDS[number]
export type BoardColor=typeof BOARD_COLORS[number]
export type BoardObject={id:string;kind:BoardKind;x:number;y:number;w:number;h:number;angle:number;color:BoardColor;stroke:number;locked?:boolean;points?:number[];text?:string;diagram?:SlideDiagram;demo?:SlideDemo}
export type BoardDocument={background:'plain'|'grid'|'ruled';objects:BoardObject[];page:number;total:number}
const PREFIX='VBOARD1:'
const integer=(n:unknown,min:number,max:number):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=min&&n<=max
export function emptyBoard(page=1,total=1):BoardDocument{return {background:'plain',objects:[],page,total}}
export function validBoardObject(o:unknown):o is BoardObject {
 if(!o||typeof o!=='object')return false
 const x=o as BoardObject
 if(typeof x.id!=='string'||!/^[-a-zA-Z0-9]{1,40}$/.test(x.id)||!BOARD_KINDS.includes(x.kind)||!integer(x.x,-320,640)||!integer(x.y,-220,440)||!integer(x.w,1,640)||!integer(x.h,1,440)||!integer(x.angle,0,359)||!BOARD_COLORS.includes(x.color)||!integer(x.stroke,1,12)||(x.locked!==undefined&&typeof x.locked!=='boolean'))return false
 const path=['pen','highlighter','line','arrow'].includes(x.kind)
 if(path){if(!Array.isArray(x.points)||x.points.length<2||x.points.length>480||x.points.length%2!==0||!x.points.every(n=>integer(n,0,1000)))return false}
 else if(x.points!==undefined)return false
 if(x.kind==='text'){if(typeof x.text!=='string'||!x.text.trim()||x.text.length>180)return false}else if(x.text!==undefined)return false
 if(x.kind==='diagram'){
  if(x.demo!==undefined){if(!validDemo(x.demo)||x.diagram!==undefined)return false}
  else if(!x.diagram||x.diagram==='none'||!BOARD_DIAGRAMS.includes(x.diagram))return false
 }else if(x.diagram!==undefined||x.demo!==undefined)return false
 return true
}
export function validBoard(d:unknown):d is BoardDocument{
 if(!d||typeof d!=='object')return false
 const x=d as BoardDocument
 return ['plain','grid','ruled'].includes(x.background)&&integer(x.page,1,30)&&integer(x.total,x.page,30)&&Array.isArray(x.objects)&&x.objects.length<=40&&x.objects.every(validBoardObject)&&new Set(x.objects.map(o=>o.id)).size===x.objects.length
}
export function encodeBoard(d:BoardDocument):string{
 if(!validBoard(d))return ''
 const objects=d.objects.map(o=>({id:o.id,kind:o.kind,x:o.x,y:o.y,w:o.w,h:o.h,angle:o.angle,color:o.color,stroke:o.stroke,locked:o.locked===true||undefined,points:o.points,text:o.text,diagram:o.diagram,demo:o.demo?{kind:o.demo.kind,a:o.demo.a,b:o.demo.b}:undefined}))
 const body=PREFIX+JSON.stringify({background:d.background,objects,page:d.page,total:d.total})
 return body.length<=BOARD_LIMIT?body:''
}
export function decodeBoard(value:string):BoardDocument|null{
 if(!value.startsWith(PREFIX)||value.length>BOARD_LIMIT)return null
 try{const d:unknown=JSON.parse(value.slice(PREFIX.length));if(!validBoard(d))return null;return {background:d.background,objects:d.objects,page:d.page,total:d.total}}catch{return null}
}
export function boardFromLegacy(value:string,page=1,total=1):BoardDocument{
 const d=decodeBoard(value);if(d)return {...d,page,total}
 const objects:BoardObject[]=[]
 for(const [i,line] of value.split('|').slice(0,40).entries()){
  const points=line.split(';').filter(p=>/^\d{1,3},\d{1,3}$/.test(p)).slice(0,240).map(p=>p.split(',').map(Number)).filter(([x,y])=>x<=320&&y<=220)
  if(!points.length)continue
  const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1])),w=Math.max(1,...points.map(p=>p[0]-x)),h=Math.max(1,...points.map(p=>p[1]-y))
  objects.push({id:'legacy-'+i,kind:'pen',x,y,w,h,angle:0,color:BOARD_COLORS[0],stroke:3,points:points.flatMap(p=>[Math.round((p[0]-x)*1000/w),Math.round((p[1]-y)*1000/h)])})
 }
 return {background:'plain',objects,page,total}
}

/** A live reveal publishes only the visible object prefix. Hidden objects are
 * omitted, never sent to learner clients. Order is the teacher's layer order. */
export function revealBoard(value:string,count:number):string{
 const doc=decodeBoard(value)
 if(!doc||!Number.isInteger(count)||count<0||count>doc.objects.length)return ''
 return encodeBoard({...doc,objects:doc.objects.slice(0,count)})
}
export function boardRevealCount(full:string,shared:string):number|null{
 const d=decodeBoard(full),s=decodeBoard(shared)
 if(!d||!s||s.objects.length>d.objects.length)return null
 return revealBoard(full,s.objects.length)===encodeBoard(s)?s.objects.length:null
}

/** Convert a selected slide without replacing existing content. Unsupported
 * resources and oversized slides remain unchanged. Adjustable objects are
 * used in visual slides, not the legacy board RPC. */
export function composeVisualSlide(body:string,extra:SlideDemo|undefined,makeId:()=>string):string|null{
 const visual=visualSlidePayload(body),single=decodeDemo(body),multi=decodeMultiDemo(body)
 const doc=visual!==null?decodeBoard(visual):emptyBoard()
 if(!doc)return null
 const objects=[...doc.objects]
 const add=(demo:SlideDemo)=>{
  const i=objects.filter(o=>o.demo).length
  objects.push({id:makeId(),kind:'diagram',x:5+(i%2)*155,y:35+(Math.floor(i/2)%2)*90,w:150,h:85,angle:0,color:BOARD_COLORS[0],stroke:3,demo})
 }
 if(visual===null){
  if(single)add(single)
  else if(multi)multi.forEach(v=>add(v.demo))
  else if(body.trim()){
   if(/^VSLIDE[A-Z0-9]*:/.test(body))return null
   const lines=body.split('\n').filter(line=>line.trim())
   if(lines.length>4||lines.some(line=>line.length>180))return null
   lines.forEach((line,i)=>objects.push({id:makeId(),kind:'text',x:12,y:8+i*20,w:296,h:18,angle:0,color:BOARD_COLORS[0],stroke:3,text:line}))
  }
 }
 if(extra){if(!validDemo(extra))return null;add(extra)}
 const encoded=encodeBoard({...doc,page:1,total:1,objects})
 return encoded?visualSlideBody(encoded):null
}
