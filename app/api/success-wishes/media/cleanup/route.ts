import {NextRequest} from 'next/server'
import {createHash,timingSafeEqual} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {reply} from '@/lib/success-wishes/server'
import {createSuccessWishesMediaAdapter,successWishesMediaReady} from '@/lib/success-wishes/media'
import {createPrivateVoiceAdapter} from '@/lib/success-wishes/voice'
import {selectRetiredMediaUploads} from '@/lib/success-wishes/cleanup-queue'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
function authorised(req:NextRequest):boolean{
 const secret=process.env.CRON_SECRET||''
 const supplied=req.headers.get('authorization')||''
 if(secret.length<24||!supplied.startsWith('Bearer '))return false
 const a=createHash('sha256').update(secret).digest()
 const b=createHash('sha256').update(supplied.slice(7)).digest()
 return timingSafeEqual(a,b)
}
export async function GET(req:NextRequest){
 if(!authorised(req))return reply({error:'Not authorised.'},401)
 if(process.env.SUCCESS_WISHES_MEDIA_CLEANUP_ENABLED!=='true')
   return reply({paused:true,deleted:0,failed:0})
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
   return reply({error:'Cleanup storage is not configured.'},503)
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
   auth:{persistSession:false,autoRefreshToken:false},
 })
 const now=new Date().toISOString()
 // Process abandoned reservations and completed but withdrawn/expired media
 // separately; otherwise a large healthy ready backlog can starve deletion.
 const {data:stale,error}=await db.from('success_wishes_media_uploads')
   .select('message_id,provider,asset_id,state,upload_expires_at')
   .in('state',['issued','processing','cleanup_required'])
   .lte('upload_expires_at',now).order('upload_expires_at',{ascending:true}).limit(15)
 if(error)return reply({error:'Could not read private cleanup queue.'},503)
 // Page media *reservations* after joining eligible retired/expired messages.
 // Paging messages first can starve cleanup when the first 20 were already deleted.
 const {data:more,error:moreError}=await selectRetiredMediaUploads(db,now)
 if(moreError)return reply({error:'Could not read retired media assets.'},503)
 const seen=new Set<string>()
 const uploads=[...(stale||[]),...(more||[])].filter(u=>{
   if(seen.has(u.message_id))return false
   seen.add(u.message_id)
   return true
 })
 let deleted=0,failed=0,skipped=0
 for(const upload of uploads||[]){
   try{
     const {data:message,error:messageError}=await db.from('success_wishes_messages')
       .select('id,state,expires_at,media_asset_id').eq('id',upload.message_id).maybeSingle()
     if(messageError)throw messageError
     const blocked=message?.state==='blocked'||message?.state==='withdrawn'||message?.state==='expired'
     const expired=message&&Date.parse(message.expires_at)<=Date.now()
     const abandoned=upload.state==='issued'||upload.state==='processing'||upload.state==='cleanup_required'
     if(!blocked&&!expired&&!abandoned){skipped++;continue}
     if(!upload.asset_id){failed++;continue} // external orphan inventory reconciliation needed
     if(message&&message.media_asset_id!==upload.asset_id && upload.state!=='cleanup_required'){
       failed++;continue // never delete a newly replaced live asset
     }
     if(upload.provider==='cloudflare-stream'){
       if(!successWishesMediaReady())throw Error('Video provider disabled')
       await createSuccessWishesMediaAdapter().deleteVideo(upload.asset_id)
     }else if(upload.provider==='supabase-private-voice'){
       await createPrivateVoiceAdapter(db.storage).deleteVoice(upload.message_id,upload.asset_id)
     }else throw Error('Unknown media provider')
     // Provider deletion succeeded. Never mark deleted on an error response.
     const {data:completed,error:completeError}=await db.from('success_wishes_media_uploads')
       .update({state:'deleted',updated_at:new Date().toISOString()})
       .eq('message_id',upload.message_id).eq('asset_id',upload.asset_id)
       .in('state',['issued','processing','ready','cleanup_required'])
       .select('message_id').maybeSingle()
     if(completeError||!completed)throw completeError||Error('Cleanup row changed')
     if(message){
       const changes:{media_status:'failed';state?:'expired'}={media_status:'failed'}
       if(expired)changes.state='expired'
       await db.from('success_wishes_messages').update(changes)
         .eq('id',upload.message_id).eq('media_asset_id',upload.asset_id)
         .in('state',['request','available','withdrawn','blocked','expired'])
     }
     deleted++
   }catch{
     failed++
     // Retry on the next scheduled run; do not lose a deletion obligation.
     await db.from('success_wishes_media_uploads').update({
       state:'cleanup_required',updated_at:new Date().toISOString(),
     }).eq('message_id',upload.message_id).neq('state','deleted')
   }
 }
 return reply({deleted,failed,skipped,checked:(uploads||[]).length},failed?503:200)
}
