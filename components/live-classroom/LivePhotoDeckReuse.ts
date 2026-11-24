'use client'
import {supabase} from '@/lib/supabase'
import {decodePhotoSlide,encodePhotoSlide,type LiveSlide} from './LiveSlideProtocol'
const bucket='vibe-live-private'
const mime=['image/jpeg','image/png','image/webp']
type Asset={id:string;object_path:string;mime_type:string;title:string;shared_at:string|null}
async function validPhoto(blob:Blob,type:string){
 if(blob.size<1||blob.size>8388608)return false
 const b=new Uint8Array(await blob.slice(0,12).arrayBuffer())
 return type==='image/jpeg'?[255,216,255].every((v,i)=>b[i]===v):type==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v):type==='image/webp'&&[82,73,70,70].every((v,i)=>b[i]===v)&&[87,69,66,80].every((v,i)=>b[i+8]===v)
}
/** Copies referenced photos through the existing room RLS, preserving placement.
 * No original signed URL or original room permission is published. */
export async function copyPhotoDeck(slides:readonly LiveSlide[],roomId:string,stillActive:()=>boolean):Promise<LiveSlide[]>{
 const auth=await supabase.auth.getUser()
 if(auth.error||!auth.data.user)throw Error('Sign in to prepare your photos.')
 const owner=auth.data.user.id
 const refs=new Map<string,{roomId:string;id:string}>()
 for(const slide of slides){const doc=decodePhotoSlide(slide.body);if(doc&&doc.roomId!==roomId)for(const p of doc.photos)refs.set(doc.roomId+':'+p.id,{roomId:doc.roomId,id:p.id})}
 if(!refs.size)return [...slides]
 const existing=await supabase.from('live_classroom_assets').select('id',{count:'exact',head:true}).eq('session_id',roomId)
 if(existing.error||existing.count===null)throw Error('Could not check classroom photo capacity.')
 if(existing.count+refs.size>20)throw Error('This classroom cannot hold all copied photos. Remove private files or use fewer photos.')
 const created:Asset[]=[],mapping=new Map<string,string>()
 const check=()=>{if(!stillActive())throw Error('Classroom changed. Photo preparation cancelled.')}
 try{
  for(const [key,ref] of refs){
   check()
   const source=await supabase.from('live_classroom_assets').select('id,title,mime_type,object_path,shared_at').eq('id',ref.id).eq('session_id',ref.roomId).eq('uploader_id',owner).in('mime_type',mime).single()
   if(source.error||!source.data)throw Error('One of your original photos is no longer accessible.')
   const a=source.data as Asset
   const original=await supabase.storage.from(bucket).download(a.object_path)
   if(original.error||!original.data||!(await validPhoto(original.data,a.mime_type)))throw Error('An original photo is unavailable or invalid.')
   check()
   const reserved=await supabase.from('live_classroom_assets').insert({session_id:roomId,title:a.title,mime_type:a.mime_type,byte_size:original.data.size}).select('id,title,mime_type,object_path,shared_at').single()
   if(reserved.error||!reserved.data)throw Error('Could not reserve a private photo.')
   const dest=reserved.data as Asset;created.push(dest)
   const uploaded=await supabase.storage.from(bucket).upload(dest.object_path,original.data,{contentType:a.mime_type,cacheControl:'0',upsert:false})
   if(uploaded.error)throw Error('Photo upload failed.')
   mapping.set(key,dest.id)
  }
  check()
  const next=slides.map(s=>{const d=decodePhotoSlide(s.body);if(!d||d.roomId===roomId)return s
   const photos=d.photos.map(p=>{const id=mapping.get(d.roomId+':'+p.id);if(!id)throw Error('Photo mapping incomplete.');return {...p,id}})
   const body=encodePhotoSlide({roomId,photos});if(!body)throw Error('Invalid copied photo layout.');return {...s,body}
  })
  return next
 }catch(e){
  for(const dest of created){try{await supabase.storage.from(bucket).remove([dest.object_path]);await supabase.from('live_classroom_assets').delete().eq('id',dest.id).eq('session_id',roomId)}catch{/* failed drafts remain private */}}
  throw e
 }
}
/** Sharing is separate from copying; every original and copied reference must
 * resolve to the current teacher-owned classroom asset before publication. */
export async function shareSlidePhotos(body:string,roomId:string,stillActive:()=>boolean){
 const doc=decodePhotoSlide(body)
 if(!doc||doc.roomId!==roomId)throw Error('Prepare photo copies in this classroom first.')
 const auth=await supabase.auth.getUser()
 if(auth.error||!auth.data.user)throw Error('Sign in to share photos.')
 const ids=doc.photos.map(p=>p.id)
 const q=await supabase.from('live_classroom_assets').select('id,shared_at').eq('session_id',roomId).eq('uploader_id',auth.data.user.id).in('id',ids).in('mime_type',mime)
 if(q.error||q.data?.length!==ids.length)throw Error('Some photos are unavailable.')
 const unshared=q.data.filter(a=>!a.shared_at).map(a=>a.id)
 if(unshared.length){
  if(!stillActive())throw Error('Classroom changed.')
  const share=await supabase.from('live_classroom_assets').update({shared_at:new Date().toISOString()}).eq('session_id',roomId).in('id',unshared).select('id')
  if(share.error||share.data?.length!==unshared.length)throw Error('Photo sharing was not completed.')
 }
}
