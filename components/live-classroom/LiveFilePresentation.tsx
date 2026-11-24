'use client'

import {useCallback,useEffect,useState} from 'react'
import {supabase} from '@/lib/supabase'
import styles from './LiveClassFiles.module.css'

type SharedFile={id:string;title:string;mime_type:string;object_path:string;shared_at:string|null}
export function LiveFilePresentation({roomId,fileId,photoFit}:{roomId:string;fileId:string;photoFit?:'contain'|'cover'}){
  const [file,setFile]=useState<SharedFile|null>(null)
  const [url,setUrl]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [nonce,setNonce]=useState(0)
  const renew=useCallback(()=>setNonce(value=>value+1),[])
  useEffect(()=>{
    let alive=true
    setFile(null);setUrl('');setError('');setLoading(true)
    const load=async()=>{
      try{
        // Never trust an identifier embedded in a shared prompt. The current
        // authenticated viewer must also have this same-room, shared asset.
        const result=await supabase.from('live_classroom_assets')
          .select('id,title,mime_type,object_path,shared_at')
          .eq('id',fileId).eq('session_id',roomId).not('shared_at','is',null).maybeSingle()
        if(result.error||!result.data)throw new Error('This shared file is unavailable or access was revoked.')
        const asset=result.data as SharedFile
        if(photoFit&&!['image/jpeg','image/png','image/webp'].includes(asset.mime_type))throw Error('This file is not a classroom photo.')
        const link=await supabase.storage.from('vibe-live-private').createSignedUrl(asset.object_path,60)
        if(link.error||!link.data?.signedUrl)throw new Error('File access could not be verified.')
        if(alive){setFile(asset);setUrl(link.data.signedUrl)}
      }catch(e){if(alive)setError(e instanceof Error?e.message:'File unavailable.')}
      finally{if(alive)setLoading(false)}
    }
    void load()
    return ()=>{alive=false}
  },[roomId,fileId,nonce,Boolean(photoFit)])
  if(photoFit)return <div style={{width:'100%',height:'100%',display:'grid',placeItems:'center',position:'relative',overflow:'hidden',background:'#fff',color:'#173c35'}}>{loading?<small role="status">Opening photo…</small>:error?<button type="button" onClick={renew} title={error}>Photo unavailable · Retry</button>:file&&url?<img src={url} alt={file.title} referrerPolicy="no-referrer" onError={()=>setError('Photo access expired.')} style={{width:'100%',height:'100%',objectFit:photoFit}}/>:null}</div>
  return <section aria-label="Shared classroom file" className={styles.preview}>
    {loading&&<p role="status">Opening shared classroom file…</p>}
    {error&&<p role="alert">{error}</p>}
    {file&&url&&<>
      <div className={styles.heading}><strong>{file.title}</strong>
        <button type="button" onClick={renew}>Renew access</button></div>
      {file.mime_type==='application/pdf'?
        <iframe src={url} title={'Shared PDF: '+file.title} sandbox="allow-same-origin" referrerPolicy="no-referrer"/>:
        <img src={url} alt={file.title} referrerPolicy="no-referrer"/>}
      <a href={url} target="_blank" rel="noopener noreferrer">Open full page or file</a>
      <small>Secure link valid for one minute. Access is rechecked before renewal.</small>
    </>}
  </section>
}
