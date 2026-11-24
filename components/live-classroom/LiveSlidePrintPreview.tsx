'use client'
import {createPortal} from 'react-dom'
import {SlideCanvas} from './LiveSlideCanvas'
import {isPhotoBody,type LiveSlide} from './LiveSlideProtocol'
export function SlidePrintPreview({title,slides,onClose}:{title:string;slides:LiveSlide[];onClose:()=>void}){
 if(slides.some(s=>isPhotoBody(s.body)))return null
 return createPortal(<div data-vibe-slide-print="true" role="dialog" aria-modal="true" aria-label="Print slides" style={{position:'fixed',inset:0,zIndex:99999,background:'#fff',color:'#173c35',overflowY:'auto',padding:16}}>
 <style>{`@media print{@page{size:A4 landscape;margin:12mm}body> *:not([data-vibe-slide-print]){display:none!important}body{margin:0!important;background:white!important;overflow:visible!important}[data-vibe-slide-print]{position:static!important;inset:auto!important;padding:0!important;overflow:visible!important}[data-vibe-slide-print] [data-print-toolbar]{display:none!important}[data-vibe-slide-print] [data-print-page]{break-after:page;break-inside:avoid;page-break-after:always;margin:0!important;width:100%!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}[data-vibe-slide-print] [data-print-page]:last-child{break-after:auto;page-break-after:auto}[data-vibe-slide-print] [data-print-page]>div{width:100%!important;max-width:none!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important;height:auto!important;overflow:visible!important;animation:none!important;box-shadow:none!important}[data-vibe-slide-print] svg{max-height:120mm!important}}`}</style>
 <header data-print-toolbar="true" style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',position:'sticky',top:0,background:'white',padding:12,zIndex:1}}><strong>{title}</strong><button type="button" onClick={()=>window.print()}>Print / Save as PDF</button><button type="button" onClick={onClose}>Close</button><small>Private notes are excluded. Check the browser print preview before saving.</small></header>
 {slides.map((slide,i)=><section data-print-page="true" key={i} style={{maxWidth:1000,margin:'20px auto'}}><SlideCanvas slide={slide} number={i+1} total={slides.length}/></section>)}
 </div>,document.body)
}
