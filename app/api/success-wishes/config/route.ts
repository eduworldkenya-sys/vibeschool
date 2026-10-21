import { reply } from '@/lib/success-wishes/server'
import { enabled } from '@/lib/success-wishes/security'
import { senderVerificationReady } from '@/lib/success-wishes/verification'
import { successWishesMediaReady } from '@/lib/success-wishes/media'
import { trustedAudioProbeReady } from '@/lib/success-wishes/audio-probe'
export const dynamic = 'force-dynamic'
export async function GET() {
  const serviceReady = enabled() && senderVerificationReady()
  const mediaReady = serviceReady && process.env.SUCCESS_WISHES_MEDIA_UPLOAD_ENABLED === 'true'
    && process.env.SUCCESS_WISHES_MEDIA_CERTIFIED === 'true'
    && successWishesMediaReady() && trustedAudioProbeReady()
  return reply({ enabled: serviceReady, mediaEnabled: mediaReady, paymentsEnabled: false, maxSeconds: 60, maxBytes: 25 * 1024 * 1024 })
}
