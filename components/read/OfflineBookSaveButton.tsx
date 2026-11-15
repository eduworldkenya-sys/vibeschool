'use client'

import { useEffect, useState } from 'react'
import type { ReaderPayload } from '@/app/read/textbook/[publicationId]/ReaderClient'
import { publicBookSnapshot, saveOfflineBook } from '@/lib/read/offlinePublicBooks'

export default function OfflineBookSaveButton({publicPayload}:{publicPayload:ReaderPayload}){
  const [status,setStatus]=useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [detail,setDetail]=useState('')
  const eligible=publicPayload.ok && publicPayload.publication.status==='published' &&
    publicPayload.publication.pricing.type==='free' &&
    publicPayload.chapters.some(ch=>ch.status==='published' && ch.can_read && Array.isArray(ch.blocks))
  useEffect(()=>{setStatus('idle');setDetail('')},[publicPayload.publication.id])
  if (!eligible) return null
  const save=async()=>{
    setStatus('saving');setDetail('')
    try{
      if (!navigator.onLine) throw new Error('Connect once to prepare the offline reader.')
      if (!('serviceWorker' in navigator)) throw new Error('Offline reading is not supported by this browser.')
      const registration=await navigator.serviceWorker.ready
      const worker=registration.active
      if(!worker) throw new Error('Offline reader is not ready. Refresh the page.')
      const channel=new MessageChannel()
      const result=await new Promise<{type:string;message?:string}>((resolve,reject)=>{
        const timer=window.setTimeout(()=>reject(new Error('Offline reader download timed out.')),120000)
        channel.port1.onmessage=e=>{window.clearTimeout(timer);resolve(e.data)}
        worker.postMessage({type:'PREPARE_OFFLINE_BOOK_READER'},[channel.port2])
      })
      if(result.type!=='OFFLINE_BOOK_READER_READY')throw new Error(result.message||'Unable to prepare offline reading.')
      await saveOfflineBook(publicBookSnapshot(publicPayload))
      setStatus('saved')
      setDetail('Book saved on this device. Open My Offline Books in airplane mode.')
    }catch(error){
      setStatus('error');setDetail(error instanceof Error?error.message:'Could not save this book.')
    }
  }
  return <section aria-label="Offline reading" style={{border:'1px solid #394452',borderRadius:14,padding:'12px 14px',margin:'12px 0 18px',background:'#151b25',fontSize:13}}>
    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <button type="button" disabled={status==='saving'} onClick={()=>void save()} style={{background:'#cfff00',border:0,borderRadius:9,color:'#111827',fontWeight:800,padding:'9px 12px',cursor:'pointer'}}>
        {status==='saving'?'Saving…':status==='saved'?'Save again':'Download for offline'}
      </button>
      <a href="/offline/books" style={{color:'#d9f89a',fontWeight:700}}>My Offline Books</a>
    </div>
    <div role="status" aria-live="polite" style={{color:status==='error'?'#ffa4a4':'#b6c2d0',fontSize:12,marginTop:6}}>
      {detail || 'Public free chapters only. Books currently remain free offline; subscription checks are not enabled.'}
    </div>
  </section>
}
