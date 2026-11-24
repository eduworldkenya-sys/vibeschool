'use client'
import {useEffect,useState} from 'react'
import {supabase} from '@/lib/supabase'
import {encodeLiveFileRef} from '@/lib/live/filePresentation'
import {studioFile,validStudioFile,STUDIO_FILE_TYPES,type StudioFileRef,type LiveSlide} from './LiveSlideProtocol'
import styles from './LiveClassFiles.module.css'

const sourceBucket='vibe-live-studio-private',roomBucket='vibe-live-private',limit=8*1024*1024
const extensions:Record<StudioFileRef['mime'],string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
async function digest(blob:Blob):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('')}
async function owner(){const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw Error('Sign in to access prepared files.');return data.user.id}
function path(ownerId:string,ref:StudioFileRef){if(!validStudioFile(ref))throw Error('Invalid prepared file.');return ownerId+'/'+ref.hash+'.'+extensions[ref.mime]}
async function signature(blob:Blob,mime:StudioFileRef['mime']){
 if(blob.size<1||blob.size>limit)return false
 const b=new Uint8Array(await blob.slice(0,16).arrayBuffer())
 const begins=(a:number[],offset=0)=>a.every((v,i)=>b[i+offset]===v)
 return mime==='application/pdf'?begins([37,80,68,70,45]):mime==='image/jpeg'?begins([255,216,255]):mime==='image/png'?begins([137,80,78,71,13,10,26,10]):begins([82,73,70,70])&&begins([87,69,66,80],8)
}
async function read(ref:StudioFileRef,ownerId:string){
 const q=await supabase.storage.from(sourceBucket).download(path(ownerId,ref))
 if(q.error||!q.data||!(await signature(q.data,ref.mime))||await digest(q.data)!==ref.hash)throw Error('Prepared file is unavailable or has changed. Add it again.')
 return new Blob([q.data],{type:ref.mime})
}
export async function uploadStudioFile(file:File):Promise<StudioFileRef>{
 if(!STUDIO_FILE_TYPES.some(type=>type===file.type))throw Error('Choose a PDF, JPEG, PNG or WebP.')
 const mime=file.type as StudioFileRef['mime']
 if(!(await signature(file,mime)))throw Error('Choose a valid file smaller than 8 MB.')
 const ownerId=await owner(),ref={hash:await digest(file),mime}
 const saved=await supabase.storage.from(sourceBucket).upload(path(ownerId,ref),file,{contentType:mime,upsert:false,cacheControl:'0'})
 if(saved.error)await read(ref,ownerId) // only identical authorized bytes count as an existing upload
 return ref
}
export async function validateStudioFiles(slides:readonly LiveSlide[]){
 const refs=slides.flatMap(s=>{const f=studioFile(s);return f?[f]:[]})
 if(!refs.length)return
 const ownerId=await owner()
 for(const ref of new Map(refs.map(f=>[f.hash+':'+f.mime,f])).values()){
  const q=await supabase.storage.from(sourceBucket).createSignedUrl(path(ownerId,ref),15)
  if(q.error||!q.data?.signedUrl)throw Error('A prepared file is unavailable. Add it again before teaching.')
 }
}
type RoomAsset={id:string;object_path:string;mime_type:string;byte_size:number;shared_at:string|null}
async function destinationId(roomId:string,ref:StudioFileRef){
 const hash=await digest(new Blob([roomId+':'+ref.hash+':'+ref.mime]))
 const s=hash.slice(0,12)+'4'+hash.slice(13,16)+'8'+hash.slice(17,32)
 return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20)
}
/** Only copies to the existing room asset authority; retries reuse the same
 * destination and verify actual bytes. The original remains private. */
export async function presentStudioFile(slide:LiveSlide,roomId:string,stillActive:()=>boolean):Promise<string>{
 const ref=studioFile(slide);if(!ref)throw Error('No prepared file.')
 const ownerId=await owner(),blob=await read(ref,ownerId),id=await destinationId(roomId,ref)
 const check=()=>{if(!stillActive())throw Error('Classroom changed. File preparation stopped.')}
 const query=()=>supabase.from('live_classroom_assets').select('id,object_path,mime_type,byte_size,shared_at').eq('id',id).eq('session_id',roomId).eq('uploader_id',ownerId).maybeSingle()
 check()
 let q=await query()
 if(q.error)throw Error('Could not check classroom file.')
 if(!q.data){
  const count=await supabase.from('live_classroom_assets').select('id',{count:'exact',head:true}).eq('session_id',roomId)
  if(count.error||count.count===null||count.count>=20)throw Error('This classroom has reached its file limit.')
  check()
  const created=await supabase.from('live_classroom_assets').insert({id,session_id:roomId,title:slide.title.trim().slice(0,120)||'Prepared file',mime_type:ref.mime,byte_size:blob.size}).select('id,object_path,mime_type,byte_size,shared_at').single()
  q=created.error?await query():created
 }
 const asset=q.data as RoomAsset|null
 if(q.error||!asset||asset.mime_type!==ref.mime||Number(asset.byte_size)!==blob.size)throw Error('Classroom file reservation could not be verified.')
 check()
 const stored=await supabase.storage.from(roomBucket).download(asset.object_path)
 if(stored.error||!stored.data){
  if(asset.shared_at)throw Error('Shared file is unavailable.')
  const upload=await supabase.storage.from(roomBucket).upload(asset.object_path,blob,{contentType:ref.mime,cacheControl:'0',upsert:false})
  if(upload.error){
   const retry=await supabase.storage.from(roomBucket).download(asset.object_path)
   if(retry.error||!retry.data||await digest(retry.data)!==ref.hash)throw Error('File copy failed. Retry the same stage.')
  }
 }else if(await digest(stored.data)!==ref.hash)throw Error('Classroom file differs from the original. It will not be shared.')
 check()
 if(!asset.shared_at){
  const shared=await supabase.from('live_classroom_assets').update({shared_at:new Date().toISOString()}).eq('id',id).eq('session_id',roomId).select('id').single()
  if(shared.error||!shared.data)throw Error('Could not share the prepared file.')
 }
 check()
 return encodeLiveFileRef(id)
}
export function StudioFilePreview({reference,title}:{reference:StudioFileRef;title:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState('')
 useEffect(()=>{let alive=true,local='';setUrl('');setError('')
  void owner().then(id=>read(reference,id)).then(blob=>{if(alive){local=URL.createObjectURL(blob);setUrl(local)}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'File unavailable.')})
  return()=>{alive=false;if(local)URL.revokeObjectURL(local)}
 },[reference.hash,reference.mime])
 return <section className={styles.preview} aria-label="Private prepared file preview">{error?<p role="alert">{error}</p>:!url?<p role="status">Opening private file…</p>:reference.mime==='application/pdf'?<iframe title={'Preview: '+title} src={url} sandbox="allow-same-origin" referrerPolicy="no-referrer"/>:<img src={url} alt={title||'Prepared photo'} referrerPolicy="no-referrer"/>}<small>Private preview. Learners receive only an explicitly shared classroom copy.</small></section>
}
