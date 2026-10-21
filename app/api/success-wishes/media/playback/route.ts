import { NextRequest } from 'next/server'
import { uuid, WishError } from '@/lib/success-wishes/contracts'
import { mediaPlaybackEnabled } from '@/lib/success-wishes/security'
import { failure, limit, reply, session } from '@/lib/success-wishes/server'
import { createSuccessWishesMediaAdapter, successWishesMediaReady } from '@/lib/success-wishes/media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Signed streaming URLs are NEVER returned by the inbox list. A candidate
// requests one only after accepting a paid message in their live guest session.
export async function GET(req: NextRequest) {
  try {
    if (!mediaPlaybackEnabled()) throw new WishError(503, 'Media playback is not open.')
    const messageId = uuid(req.nextUrl.searchParams.get('messageId'))
    const {db,inbox} = await session(req)
    await limit('video-playback:' + inbox.id,40,900)
    if (!successWishesMediaReady()) throw new WishError(503,'Video playback is not configured.')
    const {data,error} = await db.from('success_wishes_messages')
      .select('id,format,media_provider,media_asset_id,media_status,payment_status,state,expires_at')
      .eq('id',messageId).eq('inbox_id',inbox.id)
      .eq('format','video').eq('media_provider','cloudflare-stream')
      .eq('media_status','ready').eq('payment_status','paid')
      .eq('state','available').gt('expires_at',new Date().toISOString())
      .maybeSingle()
    if (error) throw error
    if (!data?.media_asset_id) throw new WishError(404,'This video is unavailable.')
    const playback = await createSuccessWishesMediaAdapter().createPlayback(data.media_asset_id)
    return reply({kind:'video',url:playback.url,expiresAt:playback.expiresAt})
  } catch(error) { return failure(error) }
}
