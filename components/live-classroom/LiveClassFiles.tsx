'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './LiveClassFiles.module.css'
import {encodeLiveFileRef} from '@/lib/live/filePresentation'

const BUCKET = 'vibe-live-private'
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = ['application/pdf','image/jpeg','image/png','image/webp'] as const
type LiveFile = {
  id: string
  title: string
  session_id: string
  mime_type: string
  byte_size: number
  object_path: string
  shared_at: string | null
}
type Preview = { id: string; url: string; type: string; title: string }

async function allowedSignature(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0,16).arrayBuffer())
  if (file.type==='application/pdf') return [37,80,68,70,45].every((b,i)=>head[i]===b)
  if (file.type==='image/png') return [137,80,78,71,13,10,26,10].every((b,i)=>head[i]===b)
  if (file.type==='image/jpeg') return [255,216,255].every((b,i)=>head[i]===b)
  if (file.type==='image/webp') return [82,73,70,70].every((b,i)=>head[i]===b)
    && [87,69,66,80].every((b,i)=>head[i+8]===b)
  return false
}

export function LiveClassFiles({roomId,teacher,status,onPresentFile,onInsertPhoto}:{
  roomId: string
  teacher: boolean
  status: 'active'|'paused'|'ended'
  onPresentFile?: (encodedReference:string)=>void
  onInsertPhoto?: (fileId:string)=>void
}) {
  const [files,setFiles] = useState<LiveFile[]>([])
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const [loading,setLoading] = useState(true)
  const [preview,setPreview] = useState<Preview|null>(null)
  const [photoLibrary,setPhotoLibrary]=useState<LiveFile[]|null>(null)

  const refresh = useCallback(async()=>{
    const result=await supabase.from('live_classroom_assets')
      .select('id,title,session_id,mime_type,byte_size,object_path,shared_at')
      .eq('session_id',roomId).order('created_at',{ascending:true}).limit(40)
    if(result.error) {
      setFiles([]);setPreview(null)
      setError('Shared files are unavailable for this classroom.')
      return
    }
    const next=(result.data??[]) as LiveFile[]
    setFiles(next)
    setPreview(value=>value&&next.some(row=>row.id===value.id)?value:null)
    setError('')
  },[roomId])

  useEffect(()=>{
    let active=true
    setLoading(true);setPreview(null);setFiles([]);setPhotoLibrary(null)
    const load=async()=>{if(!active)return;await refresh();if(active)setLoading(false)}
    void load()
    const timer=status==='ended'?null:window.setInterval(()=>{void load()},6000)
    return ()=>{active=false;if(timer!==null)window.clearInterval(timer)}
  },[roomId,status,refresh])

  async function openPhotoLibrary(){
    if(!teacher||status==='ended'||busy)return
    setBusy(true);setError('')
    try{
      const {data,error}=await supabase.auth.getUser()
      if(error||!data.user)throw Error('Sign in to access your own photos.')
      const result=await supabase.from('live_classroom_assets').select('id,title,session_id,mime_type,byte_size,object_path,shared_at').eq('uploader_id',data.user.id).neq('session_id',roomId).in('mime_type',['image/jpeg','image/png','image/webp']).order('created_at',{ascending:false}).limit(100)
      if(result.error)throw result.error
      setPhotoLibrary((result.data??[]) as LiveFile[])
    }catch(e){setError(e instanceof Error?e.message:'Unable to load previous photos.')}
    finally{setBusy(false)}
  }
  async function copyPhoto(source:LiveFile){
    if(!teacher||status==='ended'||busy||files.length>=20)return
    setBusy(true);setError('')
    let destination:LiveFile|null=null
    try{
      const {data,error}=await supabase.auth.getUser()
      if(error||!data.user)throw Error('Sign in again to reuse photos.')
      const check=await supabase.from('live_classroom_assets').select('id,title,session_id,mime_type,byte_size,object_path,shared_at').eq('id',source.id).eq('uploader_id',data.user.id).neq('session_id',roomId).in('mime_type',['image/jpeg','image/png','image/webp']).single()
      if(check.error||!check.data)throw Error('You no longer have access to this photo.')
      const original=check.data as LiveFile
      const downloaded=await supabase.storage.from(BUCKET).download(original.object_path)
      if(downloaded.error||!downloaded.data)throw Error('Could not read the original photo.')
      const file=new File([downloaded.data],original.title,{type:original.mime_type})
      if(file.size<1||file.size>MAX_BYTES||!(await allowedSignature(file)))throw Error('The original photo is invalid or too large.')
      const created=await supabase.from('live_classroom_assets').insert({session_id:roomId,title:original.title,mime_type:original.mime_type,byte_size:file.size}).select('id,title,session_id,mime_type,byte_size,object_path,shared_at').single()
      if(created.error||!created.data)throw Error('Unable to reserve a new private photo.')
      destination=created.data as LiveFile
      const stored=await supabase.storage.from(BUCKET).upload(destination.object_path,file,{contentType:original.mime_type,cacheControl:'0',upsert:false})
      if(stored.error)throw stored.error
      setPhotoLibrary(null);await refresh()
    }catch(e){
      if(destination){await supabase.storage.from(BUCKET).remove([destination.object_path]);await supabase.from('live_classroom_assets').delete().eq('id',destination.id).eq('session_id',roomId)}
      setError(e instanceof Error?e.message:'Photo copy failed. No photo has been shared.')
    }finally{setBusy(false)}
  }
  async function upload(file:File|null){
    if(!teacher||status==='ended'||!file)return
    const type=file.type
    if(!ALLOWED.some(m=>m===type)||file.size<1||file.size>MAX_BYTES
      ||!(await allowedSignature(file))) {
      setError('Choose a valid PDF, JPEG, PNG or WebP file smaller than 8 MB.')
      return
    }
    if(files.length>=20) {setError('This lesson already has 20 files.');return}
    setBusy(true);setError('')
    let row:LiveFile|null=null
    try {
      const name=file.name.replace(/\.[^.]+$/,'').trim().slice(0,120)||'Teaching material'
      const saved=await supabase.from('live_classroom_assets')
        .insert({session_id:roomId,title:name,mime_type:type,byte_size:file.size})
        .select('id,title,session_id,mime_type,byte_size,object_path,shared_at').single()
      if(saved.error||!saved.data)throw new Error(saved.error?.message||'Could not reserve a private file.')
      row=saved.data as LiveFile
      const stored=await supabase.storage.from(BUCKET).upload(row.object_path,file,{
        contentType:type,cacheControl:'0',upsert:false
      })
      if(stored.error)throw stored.error
      await refresh()
    }catch(e){
      if(row)void supabase.from('live_classroom_assets').delete().eq('id',row.id).eq('session_id',roomId)
      setError(e instanceof Error?e.message:'Upload failed. The file was not shared.')
    }finally{setBusy(false)}
  }

  async function changeShare(file:LiveFile,share:boolean){
    if(!teacher)return
    setBusy(true);setError('')
    try {
      const result=await supabase.from('live_classroom_assets')
        .update({shared_at:share?new Date().toISOString():null})
        .eq('id',file.id).eq('session_id',roomId).select('id').single()
      if(result.error||!result.data)throw new Error(result.error?.message||'File permissions could not be saved.')
      setPreview(null)
      await refresh()
      if(share&&status==='active'&&onPresentFile){const ref=encodeLiveFileRef(file.id);if(ref)onPresentFile(ref)}
    }catch(e){setError(e instanceof Error?e.message:'File sharing failed.')}
    finally{setBusy(false)}
  }

  async function deleteDraft(file:LiveFile){
    if(!teacher||file.shared_at||busy)return
    setBusy(true);setError('')
    try {
      const object=await supabase.storage.from(BUCKET).remove([file.object_path])
      if(object.error)throw object.error
      const result=await supabase.from('live_classroom_assets')
        .delete().eq('id',file.id).eq('session_id',roomId).select('id').single()
      if(result.error)throw result.error
      setPreview(null);await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Could not remove draft.')}
    finally{setBusy(false)}
  }

  async function open(file:LiveFile){
    setBusy(true);setError('')
    try {
      const result=await supabase.storage.from(BUCKET).createSignedUrl(file.object_path,60)
      if(result.error||!result.data?.signedUrl)throw new Error('This file is no longer accessible.')
      setPreview({id:file.id,url:result.data.signedUrl,type:file.mime_type,title:file.title})
    }catch(e){setPreview(null);setError(e instanceof Error?e.message:'Could not open file.')}
    finally{setBusy(false)}
  }

  const visible=teacher?files:files.filter(file=>!!file.shared_at)
  return <section className={styles.root} aria-label={status==='ended'?'Saved class files':'Class PDF and photos'}>
    <div className={styles.heading}>
      <strong>{status==='ended'?'Saved class files':'PDF & photos'}</strong>
      <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh</button>
    </div>
    {teacher&&status!=='ended'&&<label className={styles.upload}>
      Upload PDF or photo
      <input aria-label="Upload classroom PDF or photo" type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy||files.length>=20}
        onChange={event=>{const file=event.target.files?.[0]??null;event.target.value='';void upload(file)}}/>
      <small>Private until you explicitly share · 8 MB maximum</small>
    </label>}
    {teacher&&status!=='ended'&&<button type="button" disabled={busy||files.length>=20} onClick={()=>void openPhotoLibrary()}>Reuse my previous photos</button>}
    {photoLibrary!==null&&<section aria-label="My previous classroom photos"><div className={styles.heading}><strong>My previous photos</strong><button type="button" disabled={busy} onClick={()=>setPhotoLibrary(null)}>Close</button></div>{photoLibrary.length?<ul className={styles.list}>{photoLibrary.map(photo=><li key={photo.id}><div><strong>{photo.title}</strong><small>{Math.ceil(photo.byte_size/1024)} KB</small></div><button type="button" disabled={busy||files.length>=20} onClick={()=>void copyPhoto(photo)}>Copy privately</button></li>)}</ul>:<p>No accessible photos from your previous classrooms.</p>}<small>Copies belong to this classroom and remain private until shared.</small></section>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {loading?<p role="status">Loading lesson files…</p>:
      visible.length===0?<p className={styles.empty}>{teacher?'No files uploaded for this lesson.':'Your teacher has not shared files for this lesson.'}</p>:
      <ul className={styles.list}>{visible.map(file=><li key={file.id}>
        <div><strong>{file.title}</strong><small>{file.mime_type==='application/pdf'?'PDF':'Photo'} · {Math.ceil(file.byte_size/1024)} KB · {file.shared_at?'Shared':'Private draft'}</small></div>
        <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={()=>void open(file)}>View</button>
          {teacher&&(file.shared_at?<><button type="button" disabled={busy} onClick={()=>void changeShare(file,false)}>Unshare</button>{onInsertPhoto&&status==='active'&&file.mime_type.startsWith('image/')&&<button type="button" disabled={busy} onClick={()=>onInsertPhoto(file.id)}>Insert photo into slide</button>}{status==='active'&&onPresentFile&&<button type="button" disabled={busy} onClick={()=>{const ref=encodeLiveFileRef(file.id);if(ref)onPresentFile(ref)}}>Present</button>}</>:
          <><button type="button" disabled={busy||status==='ended'} onClick={()=>void changeShare(file,true)}>Share with class</button>
            <button type="button" disabled={busy} onClick={()=>void deleteDraft(file)}>Remove draft</button></>)}
        </div>
      </li>)}</ul>}
    {preview&&<div className={styles.preview} aria-label={'Preview: '+preview.title}>
      <div className={styles.heading}><strong>{preview.title}</strong>
        <button type="button" onClick={()=>setPreview(null)}>Close</button></div>
      {preview.type==='application/pdf'?
        <iframe title={'PDF: '+preview.title} src={preview.url} sandbox="allow-same-origin" referrerPolicy="no-referrer"/>:
        <img src={preview.url} alt={preview.title} referrerPolicy="no-referrer"/>}
      <a href={preview.url} target="_blank" rel="noopener noreferrer">Open full file (short-lived link)</a>
      <small>The private link expires after one minute. Use View to renew authorized access.</small>
    </div>}
  </section>
}
