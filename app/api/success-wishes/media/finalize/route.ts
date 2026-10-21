import {NextRequest} from 'next/server'
import {field,object,uuid,WishError} from '@/lib/success-wishes/contracts'
import {database,failure,json,limit,reply} from '@/lib/success-wishes/server'
import {hashSecret} from '@/lib/success-wishes/security'
import {createSuccessWishesMediaAdapter,successWishesMediaReady} from '@/lib/success-wishes/media'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(req:NextRequest){
 try{
   if(process.env.SUCCESS_WISHES_MEDIA_UPLOAD_ENABLED!=='true')
     throw new WishError(503,'Media uploads are not open.')
   const b=object(await json(req)),id=uuid(b.messageId),proof=field(b.senderProof,64,64)
   if(!/^[a-f0-9]{64}$/.test(proof))throw new WishError(401,'Verify your email first.')
   const db=database()
   await limit('media-finalize:'+id,30,3600)
   const {data:sender,error:senderError}=await db.from('success_wishes_sender_sessions')
     .select('sender_id').eq('token_hash',hashSecret(proof))
     .gt('expires_at',new Date().toISOString()).maybeSingle()
   if(senderError)throw senderError
   if(!sender)throw new WishError(401,'Verify your email first.')
   const {data:reservation,error:claimError}=await db.from('success_wishes_media_uploads')
     .select('kind,provider,asset_id,state').eq('message_id',id).eq('sender_id',sender.sender_id)
     .in('state',['issued','processing','ready']).maybeSingle()
   if(claimError)throw claimError
   if(!reservation?.asset_id)throw new WishError(404,'This private upload is unavailable.')
   if(reservation.state==='ready')return reply({ready:true})
   const {data:message,error:messageError}=await db.from('success_wishes_messages')
     .select('id,media_asset_id').eq('id',id).eq('sender_id',sender.sender_id)
     .eq('media_asset_id',reservation.asset_id).eq('payment_status','paid')
     .eq('state','request').gt('expires_at',new Date().toISOString()).maybeSingle()
   if(messageError)throw messageError
   if(!message)throw new WishError(404,'This paid wish is unavailable.')
   if(reservation.kind==='voice'){
     return reply({ready:false,status:'awaiting_validation',
       message:'Audio must pass independent server-side content and duration inspection.'},202)
   }
   if(!successWishesMediaReady())throw new WishError(503,'Private video processing is unavailable.')
   const status=await createSuccessWishesMediaAdapter().getStatus(reservation.asset_id)
   if(status.state==='pending'){
     await db.from('success_wishes_media_uploads').update({state:'processing',updated_at:new Date().toISOString()})
       .eq('message_id',id).in('state',['issued','processing'])
     return reply({ready:false,status:'processing'},202)
   }
   if(status.state==='failed'){
     await db.from('success_wishes_media_uploads').update({state:'cleanup_required',updated_at:new Date().toISOString()})
       .eq('message_id',id).in('state',['issued','processing'])
     throw new WishError(409,'The video did not pass provider validation.')
   }
   const {data:updated,error:updateError}=await db.from('success_wishes_messages')
     .update({media_status:'ready'}).eq('id',id).eq('sender_id',sender.sender_id)
     .eq('payment_status','paid').eq('media_status','pending')
     .eq('state','request').eq('media_asset_id',reservation.asset_id)
     .gt('expires_at',new Date().toISOString()).select('id').maybeSingle()
   if(updateError)throw updateError
   if(!updated)throw new WishError(409,'This message is no longer available.')
   await db.from('success_wishes_media_uploads').update({state:'ready',updated_at:new Date().toISOString()})
     .eq('message_id',id).in('state',['issued','processing'])
   return reply({ready:true,status:'ready'})
 }catch(error){return failure(error)}
}
