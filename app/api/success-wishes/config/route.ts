import { reply } from '@/lib/success-wishes/server'
import { enabled } from '@/lib/success-wishes/security'
import { senderVerificationReady } from '@/lib/success-wishes/verification'
export const dynamic = 'force-dynamic'
export async function GET() {
  return reply({ enabled: enabled() && senderVerificationReady(), mediaEnabled: false, paymentsEnabled: false, maxSeconds: 60, maxBytes: 25 * 1024 * 1024 })
}
