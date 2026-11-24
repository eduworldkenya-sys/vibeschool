'use client'
import {encodeSlide,type LiveSlide} from './LiveSlideProtocol'
const MAX_PDF_BYTES=12*1024*1024
/** PDF import deliberately extracts editable text; it does not claim visual fidelity. */
export async function importPdfSlides(file:File):Promise<{title:string;slides:LiveSlide[]}>{
 if(file.size<5||file.size>MAX_PDF_BYTES)throw Error('Choose a PDF smaller than 12 MB.')
 const signature=new Uint8Array(await file.slice(0,5).arrayBuffer())
 if(![37,80,68,70,45].every((v,i)=>signature[i]===v))throw Error('Invalid PDF file.')
 const pdfjs=await import('pdfjs-dist')
 pdfjs.GlobalWorkerOptions.workerSrc=`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
 const task=pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false})
 try{
  const pdf=await task.promise
  if(pdf.numPages<1||pdf.numPages>30)throw Error('Import a PDF containing 1–30 pages.')
  const slides:LiveSlide[]=[]
  for(let n=1;n<=pdf.numPages;n++){
   const page=await pdf.getPage(n)
   try{
    const content=await page.getTextContent()
    const body=content.items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim()
    if(!body)throw Error('Page '+n+' has no extractable text. Scanned pages need image/PDF presentation instead.')
    const slide={title:'Page '+n,body}
    if(!encodeSlide(slide,n,pdf.numPages))throw Error('Page '+n+' is too long for a live slide. Split the PDF into shorter pages.')
    slides.push(slide)
   }finally{page.cleanup()}
  }
  return {title:file.name.replace(/\.pdf$/i,'').trim().slice(0,120)||'Imported PDF',slides}
 }finally{await task.destroy()}
}
