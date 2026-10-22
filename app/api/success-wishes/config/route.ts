import { reply } from '@/lib/success-wishes/server'
import { enabled } from '@/lib/success-wishes/security'
import { phoneVerificationReady } from '@/lib/success-wishes/phone-verification'
import { successWishesMediaReady } from '@/lib/success-wishes/media'
import { trustedAudioProbeReady } from '@/lib/success-wishes/audio-probe'
import {guestMpesaSandboxEnabled} from '@/lib/success-wishes/guest-mpesa-contract'
import {guestMpesaTransportReady} from '@/lib/success-wishes/mpesa-transport'
export const dynamic = 'force-dynamic'
export async function GET() {
  const serviceReady = enabled() && phoneVerificationReady()
  const mediaReady = serviceReady && process.env.SUCCESS_WISHES_MEDIA_UPLOAD_ENABLED === 'true'
    && process.env.SUCCESS_WISHES_MEDIA_CERTIFIED === 'true'
    && successWishesMediaReady() && trustedAudioProbeReady()
  const sandboxPaymentsReady=serviceReady && guestMpesaSandboxEnabled() && guestMpesaTransportReady()
    && process.env.SUCCESS_WISHES_MPESA_ISOLATED_DATABASE_CONFIRMED==='true'
  return reply({ enabled: serviceReady, mediaEnabled: mediaReady, paymentsEnabled: sandboxPaymentsReady, maxSeconds: 60, maxBytes: 25 * 1024 * 1024 })
}
