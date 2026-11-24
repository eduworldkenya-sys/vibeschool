'use client'
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate'
import {encodeSlide,decodeAssessment,assessmentPrompt,isPhotoBody,isDemoBody,isMultiDemoBody,visualSlidePayload,type LiveSlide} from './LiveSlideProtocol'
const PKG='http://schemas.openxmlformats.org/package/2006/relationships'
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const P='http://schemas.openxmlformats.org/presentationml/2006/main'
const A='http://schemas.openxmlformats.org/drawingml/2006/main'
const MAX=12*1024*1024
const mime='application/vnd.openxmlformats-officedocument.presentationml.presentation'
const escape=(v:string)=>v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
function xml(source:string){
 if(/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('Unsafe PowerPoint XML.')
 const d=new DOMParser().parseFromString(source,'application/xml')
 if(d.getElementsByTagName('parsererror').length)throw Error('Invalid PowerPoint XML.')
 return d
}
const children=(node:Document|Element,ns:string,name:string)=>Array.from(node.getElementsByTagNameNS(ns,name))
/** Only text and slide order are imported. Complex layout, media and macros
 * are not executed or silently represented as fully compatible. */
export async function importPowerPoint(file:File):Promise<{title:string;slides:LiveSlide[]}>{
 if(!/\.pptx$/i.test(file.name)||file.size<4||file.size>MAX)throw Error('Choose a .pptx file smaller than 12 MB.')
 const input=new Uint8Array(await file.arrayBuffer())
 if(input[0]!==80||input[1]!==75)throw Error('Invalid PowerPoint file.')
 let size=0,count=0
 const files=unzipSync(input,{filter:f=>{
  if(++count>2000)throw Error('PowerPoint archive contains too many files.')
  if(!/^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/slide[0-9]+\.xml)$/.test(f.name))return false
  size+=f.originalSize
  if(f.originalSize>2*1024*1024||size>16*1024*1024)throw Error('PowerPoint XML exceeds the import limit.')
  return true
 }})
 const read=(name:string)=>{const v=files[name];if(!v)throw Error('Required PowerPoint content is missing.');return xml(strFromU8(v))}
 const order=children(read('ppt/presentation.xml'),P,'sldId')
 if(order.length<1||order.length>30)throw Error('Import 1–30 slides at a time.')
 const rels=children(read('ppt/_rels/presentation.xml.rels'),PKG,'Relationship')
 const slides=order.map((item,i)=>{
  const rid=item.getAttributeNS(REL,'id')
  const relation=rels.find(r=>r.getAttribute('Id')===rid)
  const target=relation?.getAttribute('Target')??''
  const match=target.match(/^(?:\/ppt\/)?slides\/(slide[0-9]+\.xml)$/)
  if(!match||relation?.getAttribute('TargetMode')==='External'||relation?.getAttribute('Type')!==REL+'/slide')throw Error('Unsupported slide relationship.')
  const doc=read('ppt/slides/'+match[1])
  const paragraphs=children(doc,A,'p').map(p=>children(p,A,'t').map(t=>t.textContent??'').join('').trim()).filter(Boolean)
  if(!paragraphs.length)throw Error('Slide '+(i+1)+' contains no editable text; import visual slides using PDF presentation.')
  const title=paragraphs[0].length<=120?paragraphs[0]:'Slide '+(i+1)
  const body=(title===paragraphs[0]?paragraphs.slice(1):paragraphs).join('\n')
  const slide={title,body}
  if(!encodeSlide(slide,i+1,order.length))throw Error('Slide '+(i+1)+' exceeds the live slide size limit.')
  return slide
 })
 return {title:file.name.replace(/\.pptx$/i,'').trim().slice(0,120)||'Imported presentation',slides}
}
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const relationships=(items:string[])=>declaration+'<Relationships xmlns="'+PKG+'">'+items.join('')+'</Relationships>'
const relationship=(id:string,type:string,target:string)=>'<Relationship Id="'+id+'" Type="'+REL+'/'+type+'" Target="'+target+'"/>'
const namespaces='xmlns:p="'+P+'" xmlns:a="'+A+'" xmlns:r="'+REL+'"'
const group='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
const paragraph=(text:string,size:number)=>'<a:p><a:r><a:rPr lang="en-US" sz="'+size+'"/><a:t xml:space="preserve">'+escape(text)+'</a:t></a:r><a:endParaRPr lang="en-US" sz="'+size+'"/></a:p>'
function shape(id:number,name:string,text:string,y:number,height:number,size:number){
 return '<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="'+name+'"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="'+y+'"/><a:ext cx="11277600" cy="'+height+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>'+text.split(/\r?\n/).map(t=>paragraph(t,size)).join('')+'</p:txBody></p:sp>'
}
const theme=declaration+'<a:theme xmlns:a="'+A+'" name="VibeSchool"><a:themeElements><a:clrScheme name="VibeSchool">'+[['dk1','162B25'],['lt1','FFFFFF'],['dk2','27463C'],['lt2','E8F2ED'],['accent1','087E72'],['accent2','2466A4'],['accent3','B65735'],['accent4','C8A448'],['accent5','7059A1'],['accent6','467C52'],['hlink','2466A4'],['folHlink','7059A1']].map(([n,c])=>'<a:'+n+'><a:srgbClr val="'+c+'"/></a:'+n+'>').join('')+'</a:clrScheme><a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Simple"><a:fillStyleLst>'+Array.from({length:3},()=>'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>').join('')+'</a:fillStyleLst><a:lnStyleLst>'+Array.from({length:3},()=>'<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>').join('')+'</a:lnStyleLst><a:effectStyleLst>'+Array.from({length:3},()=>'<a:effectStyle><a:effectLst/></a:effectStyle>').join('')+'</a:effectStyleLst><a:bgFillStyleLst>'+Array.from({length:3},()=>'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>').join('')+'</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'
const clrMap='<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>'
export function exportPowerPoint(slides:LiveSlide[]):Blob{
 if(!slides.length||slides.length>30)throw Error('A presentation must have 1–30 slides.')
 const file:Record<string,Uint8Array>={}
 const put=(name:string,content:string)=>{file[name]=strToU8(content)}
 const types='application/vnd.openxmlformats-officedocument.presentationml.'
 put('[Content_Types].xml',declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="'+mime+'.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="'+types+'slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="'+types+'slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'+slides.map((_,i)=>'<Override PartName="/ppt/slides/slide'+(i+1)+'.xml" ContentType="'+types+'slide+xml"/>').join('')+'</Types>')
 // Presentation part uses presentation.main+xml (not the file-level MIME).
 const ct=strFromU8(file['[Content_Types].xml']).replace(mime+'.main+xml',types+'presentation.main+xml');put('[Content_Types].xml',ct)
 put('_rels/.rels',relationships([relationship('rId1','officeDocument','ppt/presentation.xml')]))
 put('ppt/presentation.xml',declaration+'<p:presentation '+namespaces+'><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>'+slides.map((_,i)=>'<p:sldId id="'+(256+i)+'" r:id="rId'+(i+2)+'"/>').join('')+'</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>')
 put('ppt/_rels/presentation.xml.rels',relationships([relationship('rId1','slideMaster','slideMasters/slideMaster1.xml'),...slides.map((_,i)=>relationship('rId'+(i+2),'slide','slides/slide'+(i+1)+'.xml'))]))
 put('ppt/theme/theme1.xml',theme)
 put('ppt/slideMasters/slideMaster1.xml',declaration+'<p:sldMaster '+namespaces+'><p:cSld name="Master"><p:spTree>'+group+'</p:spTree></p:cSld>'+clrMap+'<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>')
 put('ppt/slideMasters/_rels/slideMaster1.xml.rels',relationships([relationship('rId1','slideLayout','../slideLayouts/slideLayout1.xml'),relationship('rId2','theme','../theme/theme1.xml')]))
 put('ppt/slideLayouts/slideLayout1.xml',declaration+'<p:sldLayout '+namespaces+' type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>'+group+'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>')
 put('ppt/slideLayouts/_rels/slideLayout1.xml.rels',relationships([relationship('rId1','slideMaster','../slideMasters/slideMaster1.xml')]))
 slides.forEach((slide,i)=>{
  if(isPhotoBody(slide.body)||isDemoBody(slide.body)||isMultiDemoBody(slide.body)||visualSlidePayload(slide.body)!==null||(slide.diagram&&slide.diagram!=='none'))throw Error('PowerPoint text export cannot preserve visual slide '+(i+1)+'. Use Print / Save PDF for its appearance.')
  const a=decodeAssessment(slide.body),body=a?assessmentPrompt(a):slide.body
  if(!encodeSlide(slide,i+1,slides.length))throw Error('Slide '+(i+1)+' is empty or invalid.')
  put('ppt/slides/slide'+(i+1)+'.xml',declaration+'<p:sld '+namespaces+'><p:cSld><p:spTree>'+group+shape(2,'Title',slide.title||'Untitled',457200,914400,3000)+shape(3,'Body',body,1600200,4800600,2000)+'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>')
  put('ppt/slides/_rels/slide'+(i+1)+'.xml.rels',relationships([relationship('rId1','slideLayout','../slideLayouts/slideLayout1.xml')]))
 })
 const bytes=zipSync(file,{level:3})
 return new Blob([new Uint8Array(bytes)],{type:mime})
}
