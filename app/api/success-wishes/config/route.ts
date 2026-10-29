import { database } from '@/lib/success-wishes/server'
import { reply } from '@/lib/success-wishes/server'
import { enabled } from '@/lib/success-wishes/security'
import { phoneVerificationReady } from '@/lib/success-wishes/phone-verification'
import { successWishesMediaReady } from '@/lib/success-wishes/media'
import { trustedAudioProbeReady } from '@/lib/success-wishes/audio-probe'
export const dynamic = 'force-dynamic'
export async function GET() {
  const serviceReady = enabled() && phoneVerificationReady()
  const mediaReady = serviceReady && process.env.SUCCESS_WISHES_MEDIA_UPLOAD_ENABLED === 'true'
    && process.env.SUCCESS_WISHES_MEDIA_CERTIFIED === 'true'
    && successWishesMediaReady() && trustedAudioProbeReady()
  let paymentsEnabled = false, groupPaymentsEnabled = false
  if(enabled()){
    const {data,error}=await database().from('mpesa_runtime_control').select('initiation_enabled,success_wishes_enabled,success_wishes_group_enabled').eq('singleton',true).maybeSingle()
    paymentsEnabled=!error&&data?.initiation_enabled===true&&data?.success_wishes_enabled===true
    groupPaymentsEnabled=paymentsEnabled&&data?.success_wishes_group_enabled===true
  }
  return reply({ enabled: serviceReady, mediaEnabled: mediaReady, paymentsEnabled, groupPaymentsEnabled, maxSeconds: 60, maxBytes: 25 * 1024 * 1024 })
}
