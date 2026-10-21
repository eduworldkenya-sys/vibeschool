import { NextRequest } from 'next/server'
import { uuid, WishError } from '@/lib/success-wishes/contracts'
import { failure, limit, reply, session } from '@/lib/success-wishes/server'
import { createPrivateVoiceAdapter } from '@/lib/success-wishes/voice'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A fresh recipient session is checked on EVERY request. Never put signed
// storage URLs in the inbox list or offer them to unaccepted recipients.
export async function GET(req: NextRequest) {
  try {
    const messageId = uuid(req.nextUrl.searchParams.get('messageId'))
    const {db,inbox} = await session(req)
    await limit('voice-playback:' + inbox.id, 40, 900)
    const {data:message,error} = await db.from('success_wishes_messages')
      .select('id,media_provider,media_asset_id,media_status,payment_status,state,expires_at')
      .eq('id',messageId).eq('inbox_id',inbox.id)
      .eq('format','voice').eq('media_provider','supabase-private-voice')
      .eq('media_status','ready').eq('payment_status','paid')
      .eq('state','available').gt('expires_at',new Date().toISOString())
      .maybeSingle()
    if(error)throw error
    if(!message?.media_asset_id)throw new WishError(404,'This recording is unavailable.')

    const {data:verified,error:validationError}=await db.from('success_wishes_voice_validations')
      .select('object_path,duration_seconds')
      .eq('message_id',message.id).eq('object_path',message.media_asset_id)
      .lte('verified_at',new Date().toISOString()).maybeSingle()
    if(validationError)throw validationError
    if(!verified)throw new WishError(404,'This recording is unavailable.')
    const duration=Number(verified.duration_seconds)
    if(!Number.isFinite(duration)||duration<=0||duration>60)
      throw new WishError(404,'This recording is unavailable.')

    const signed=await createPrivateVoiceAdapter(db.storage).signedPlayback(
      message.id,verified.object_path,duration,
    )
    // No indexed/token-bearing URL is ever returned through a GET browser cache.
    return reply({kind:'voice',url:signed.url,expiresAt:new Date(Date.now()+signed.ttlSeconds*1000).toISOString()})
  }catch(error){return failure(error)}
}
