import {NextRequest} from 'next/server'
import {field,object,retryKey,uuid,WishError} from '@/lib/success-wishes/contracts'
import {database,failure,json,limit,reply} from '@/lib/success-wishes/server'
import {hashSecret} from '@/lib/success-wishes/security'
import {createPrivateVoiceAdapter,validVoiceUpload} from '@/lib/success-wishes/voice'
import {createSuccessWishesMediaAdapter,successWishesMediaReady} from '@/lib/success-wishes/media'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const MIME_VIDEO=new Set(['video/mp4','video/webm','video/quicktime'])
export async function POST(req:NextRequest){
 let reservedId:string|null=null
 let allocatedAsset:string|null=null
 try{
   if(process.env.SUCCESS_WISHES_MEDIA_UPLOAD_ENABLED!=='true' || process.env.SUCCESS_WISHES_MEDIA_CERTIFIED!=='true')
     throw new WishError(503,'Media uploads are not open.')
   const b=object(await json(req)),messageId=uuid(b.messageId)
   const proof=field(b.senderProof,64,64),nonce=retryKey(b.requestKey)
   if(!/^[a-f0-9]{64}$/.test(proof))throw new WishError(401,'Verify your email first.')
   const kind=field(b.kind,5,5)
   if(!['voice','video'].includes(kind))throw new WishError(400,'Choose voice or video.')
   const mime=field(b.contentType,5,80),bytes=b.bytes
   if(!Number.isInteger(bytes)||Number(bytes)<1||Number(bytes)>52428800)
     throw new WishError(400,'Choose a valid file under 50 MB.')
   if(kind==='voice')validVoiceUpload(mime,Number(bytes))
   else if(!MIME_VIDEO.has(mime))throw new WishError(400,'Choose a supported video file.')
   if(kind==='video'&&!successWishesMediaReady())throw new WishError(503,'Private video storage is unavailable.')
   const db=database()
   await limit('media-reserve:'+messageId,4,3600)
   const {data:sender,error:senderError}=await db.from('success_wishes_sender_sessions')
      .select('sender_id').eq('token_hash',hashSecret(proof))
      .gt('expires_at',new Date().toISOString()).maybeSingle()
   if(senderError)throw senderError
   if(!sender)throw new WishError(401,'Verify your email first.')
   const provider=kind==='voice'?'supabase-private-voice':'cloudflare-stream'
   const {data:claimed,error:claimError}=await db.from('success_wishes_media_uploads')
     .insert({
       message_id:messageId,sender_id:sender.sender_id,idempotency_key:nonce,
       kind,provider,content_type:mime,bytes_declared:Number(bytes),
     }).select('message_id').single()
   if(claimError?.code==='23505')throw new WishError(409,'This wish already has a media reservation. Check its status before retrying.')
   if(claimError?.code==='23514')throw new WishError(409,'This paid wish cannot receive an upload. Check the school or message status.')
   if(claimError||!claimed)throw claimError||new Error('Media reservation failed.')
   reservedId=messageId

   // External provider allocation MUST happen after the database claim.
   // If any later operation fails, a reconciliation marker remains durable.
   const upload=kind==='voice'
      ?await createPrivateVoiceAdapter(db.storage).reserve(messageId,mime,Number(bytes))
      :await createSuccessWishesMediaAdapter().createDirectUpload(messageId)
   const assetId='path' in upload?upload.path:upload.uid
   allocatedAsset=assetId
   const {data:saved,error:saveError}=await db.from('success_wishes_media_uploads')
     .update({asset_id:assetId,state:'issued',upload_expires_at:('expiresAt' in upload
       ?upload.expiresAt:new Date(Date.now()+2*60*60*1000).toISOString()),
       updated_at:new Date().toISOString()})
     .eq('message_id',messageId).eq('state','reserving').select('message_id').maybeSingle()
   if(saveError||!saved)throw saveError||new Error('Reservation could not be recorded.')
   const {data:updated,error:updateError}=await db.from('success_wishes_messages')
     .update({media_asset_id:assetId}).eq('id',messageId).eq('sender_id',sender.sender_id)
     .eq('payment_status','paid').eq('media_status','pending').eq('state','request')
     .gt('expires_at',new Date().toISOString()).select('id').maybeSingle()
   if(updateError||!updated)throw updateError||new Error('Paid message was no longer available.')
   // This capability is returned only after its owner and asset are durable.
   return reply({messageId,kind,path:assetId,
     uploadUrl:'uploadURL' in upload?upload.uploadURL:upload.uploadUrl,
     uploadToken:'uploadToken' in upload?upload.uploadToken:undefined,
     method:kind==='voice'?'PUT':'POST',status:'issued'},201)
 }catch(error){
   if(reservedId){
     // Persist any allocated provider UID/path BEFORE recording a cleanup
     // obligation. A crash here still needs provider metadata reconciliation.
     if(allocatedAsset)try{
       await database().from('success_wishes_media_uploads').update({
         asset_id:allocatedAsset,updated_at:new Date().toISOString(),
       }).eq('message_id',reservedId).is('asset_id',null)
     }catch{ /* missing provider evidence requires manual reconciliation */ }
     // This state is never considered paid/delivered. Reconciliation and
     // orphan-provider cleanup are required before retrying.
     try{
       await database().from('success_wishes_media_uploads').update({
         state:'cleanup_required',updated_at:new Date().toISOString(),
       }).eq('message_id',reservedId).in('state',['reserving','issued'])
     }catch{ /* the reservation itself is still durable */ }
   }
   return failure(error)
 }
}
