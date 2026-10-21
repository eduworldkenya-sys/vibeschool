import {NextRequest} from 'next/server'
import {field,object,uuid,WishError} from '@/lib/success-wishes/contracts'
import {database,failure,json,limit,reply} from '@/lib/success-wishes/server'
import {hashSecret} from '@/lib/success-wishes/security'
import {createPrivateVoiceAdapter,VOICE_BUCKET} from '@/lib/success-wishes/voice'
import {inspectPrivateAudio,trustedAudioProbeReady} from '@/lib/success-wishes/audio-probe'
export const runtime='nodejs'
export const dynamic='force-dynamic'

// Sender may ask for inspection only after durable payment and an upload that
// belongs to their verified identity. Neither the browser nor its metadata
// can mark media as ready. Missing ffprobe infrastructure fails closed.
export async function POST(req:NextRequest){
 try{
   if(process.env.SUCCESS_WISHES_MEDIA_CERTIFIED!=='true' || !trustedAudioProbeReady())throw new WishError(503,'Voice verification is not available.')
   const body=object(await json(req))
   const id=uuid(body.messageId),proof=field(body.senderProof,64,64)
   if(!/^[a-f0-9]{64}$/.test(proof))throw new WishError(401,'Verify your email first.')
   const db=database()
   await limit('audio-verify:'+id,8,3600)
   const {data:session,error:sessionError}=await db.from('success_wishes_sender_sessions')
     .select('sender_id').eq('token_hash',hashSecret(proof))
     .gt('expires_at',new Date().toISOString()).maybeSingle()
   if(sessionError)throw sessionError
   if(!session)throw new WishError(401,'Verify your email first.')
   const {data:message,error:messageError}=await db.from('success_wishes_messages')
     .select('id,media_asset_id').eq('id',id).eq('sender_id',session.sender_id)
     .eq('format','voice').eq('media_provider','supabase-private-voice')
     .eq('payment_status','paid').eq('media_status','pending')
     .eq('state','request').gt('expires_at',new Date().toISOString()).maybeSingle()
   if(messageError)throw messageError
   if(!message?.media_asset_id)throw new WishError(404,'This voice upload is unavailable.')
   const adapter=createPrivateVoiceAdapter(db.storage)
   const info=await adapter.inspect(id,message.media_asset_id)
   const {data:blob,error:downloadError}=await db.storage.from(VOICE_BUCKET).download(message.media_asset_id)
   if(downloadError||!blob)throw new WishError(503,'The private audio could not be inspected.')
   if(blob.size!==info.size)throw new WishError(409,'The uploaded audio does not match the stored file.')
   const bytes=new Uint8Array(await blob.arrayBuffer())
   const checked=await inspectPrivateAudio({bytes,mime:info.contentType})
   if(checked.byteSize!==info.size)throw new WishError(409,'The uploaded audio changed during inspection.')
   const {error:upsertError}=await db.from('success_wishes_voice_validations')
     .upsert({
       message_id:id,object_path:message.media_asset_id,mime_type:checked.mimeType,
       byte_size:checked.byteSize,sha256:checked.sha256,duration_seconds:checked.durationSeconds,
       validator_version:'trusted-audio-probe-v1',verified_at:new Date().toISOString(),
     },{onConflict:'message_id'})
   if(upsertError)throw upsertError
   const {data:accepted,error:readyError}=await db.from('success_wishes_messages')
     .update({media_status:'ready'}).eq('id',id).eq('sender_id',session.sender_id)
     .eq('payment_status','paid').eq('media_status','pending')
     .eq('state','request').eq('media_asset_id',message.media_asset_id)
     .gt('expires_at',new Date().toISOString()).select('id').maybeSingle()
   if(readyError)throw readyError
   if(!accepted)throw new WishError(409,'This wish is no longer awaiting verification.')
   return reply({ready:true,message:'Private voice has passed independent file inspection.'})
 }catch(error){return failure(error)}
}
