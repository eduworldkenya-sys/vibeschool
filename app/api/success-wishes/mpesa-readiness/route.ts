import { createPaymentReadinessHandler } from '@/lib/success-wishes/mpesa-readiness'
import { verifiedFounderOperator } from '@/lib/success-wishes/mpesa-operator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Next.js route exports only GET and runtime settings; never sends an STK prompt.
const handler = createPaymentReadinessHandler({
  verifyOperator: verifiedFounderOperator,
  providerFetch: (input, init) => fetch(input, init),
  env: process.env,
})
export async function GET(req: Request) { return handler(req) }
